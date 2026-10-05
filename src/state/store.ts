import { useSyncExternalStore } from 'react';
import type { CategoryId, MessageMeta, SenderGroup, SenderOverride, SenderStatus } from '../core/types';
import { groupMessages } from '../core/classifier';
import { ALLOWED_LABEL_NAME, CATEGORIES, CATEGORY_BY_ID, LABEL_PREFIX, categoryLabelName } from '../core/categories';
import { buildAllowFilter, buildBlockFilter, buildCategoryFilters, isCategoryFilter, sameFilter } from '../core/filters';
import { buildUnsubscribeEmail, parseListUnsubscribe } from '../core/unsubscribe';
import { de, formatBytes } from '../core/format';
import { getClientId, saveClientId } from '../config';
import { GoogleAuth, ReauthRequiredError } from '../auth/googleAuth';
import type { GmailApi } from '../gmail/api';
import { RealGmailClient } from '../gmail/realClient';
import { DemoGmailClient } from '../gmail/demoClient';
import { LocalStore } from '../storage/db';

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  /** Nombre de mails récents analysés. */
  syncLimit: number;
  /** Appliquer les libellés MailSort dans Gmail après chaque synchronisation. */
  autoApplyLabels: boolean;
  /** Créer des filtres Gmail pour que les FUTURS mails soient aussi triés. */
  autoFilters: boolean;
  theme: Theme;
}

export interface BusyState {
  label: string;
  done: number;
  total: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error' | 'info';
}

export interface AppState {
  phase: 'loading' | 'needsClientId' | 'signedOut' | 'ready';
  demo: boolean;
  email?: string;
  needsReconnect: boolean;
  messages: Map<string, MessageMeta>;
  overrides: Map<string, SenderOverride>;
  groups: SenderGroup[];
  groupsByKey: Map<string, SenderGroup>;
  /** Identifiants Gmail des libellés MailSort, par nom. */
  labelIds: Record<string, string>;
  lastSync?: number;
  lastLabelApply?: number;
  busy: BusyState | null;
  toasts: Toast[];
  settings: Settings;
  dismissed: Set<string>;
}

const SETTINGS_KEY = 'mailsort.settings';
const DEMO_KEY = 'mailsort.demo';
const DEFAULT_SETTINGS: Settings = { syncLimit: 5000, autoApplyLabels: true, autoFilters: true, theme: 'auto' };

type ProgressFn = (done: number, total: number, label?: string) => void;

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function initialState(): AppState {
  return {
    phase: 'loading',
    demo: false,
    needsReconnect: false,
    messages: new Map(),
    overrides: new Map(),
    groups: [],
    groupsByKey: new Map(),
    labelIds: {},
    busy: null,
    toasts: [],
    settings: loadSettings(),
    dismissed: new Set(),
  };
}

class Store {
  state: AppState = initialState();
  private listeners = new Set<() => void>();
  private auth?: GoogleAuth;
  private api?: GmailApi;
  private local?: LocalStore;
  private toastSeq = 0;
  private filterSyncTimer: ReturnType<typeof setTimeout> | undefined;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  private recompute(patch: Partial<AppState> = {}) {
    const messages = patch.messages ?? this.state.messages;
    const overrides = patch.overrides ?? this.state.overrides;
    const groups = groupMessages(messages.values(), overrides).sort((a, b) => b.newest - a.newest);
    this.set({ ...patch, groups, groupsByKey: new Map(groups.map((g) => [g.key, g])) });
  }

  // -------------------------------------------------------------------------
  // Démarrage, connexion
  // -------------------------------------------------------------------------

  async init() {
    applyTheme(this.state.settings.theme);
    try {
      if (localStorage.getItem(DEMO_KEY) === '1') return await this.startDemo();
      const clientId = getClientId();
      if (!clientId) return this.set({ phase: 'needsClientId' });
      this.auth = new GoogleAuth(clientId);
      this.auth.onChange(() => this.set({ needsReconnect: this.auth?.needsReconnect ?? false }));
      void this.auth.prepare().catch(() => undefined);
      if (this.auth.hasAccount) {
        await this.openAccount();
      } else {
        this.set({ phase: 'signedOut' });
      }
    } catch (e) {
      this.set({ phase: 'signedOut' });
      this.toast(errorText(e), 'error');
    }
  }

  setClientId(id: string): boolean {
    if (!saveClientId(id)) return false;
    void this.init();
    return true;
  }

  /** À appeler directement depuis un toucher (sinon Safari bloque la fenêtre Google). */
  async signIn() {
    if (!this.auth) return;
    try {
      await this.auth.signIn(!this.auth.email);
      await this.openAccount();
      if (this.state.messages.size === 0) await this.sync();
    } catch (e) {
      this.toast(errorText(e), 'error');
    }
  }

  signInWithRedirect() {
    this.auth?.signInWithRedirect(!this.auth.email);
  }

  /** Bandeau « Reconnecter » : un toucher, pas de mot de passe si la session Google est ouverte. */
  async reconnect() {
    if (!this.auth) return;
    try {
      await this.auth.signIn(false);
      this.toast('Session Google renouvelée', 'ok');
    } catch (e) {
      if (e instanceof ReauthRequiredError) this.auth.signInWithRedirect(false);
      else this.toast(errorText(e), 'error');
    }
  }

  private async openAccount() {
    if (!this.auth) return;
    this.api = new RealGmailClient(this.auth);
    let email = this.auth.email;
    if (!email) {
      email = (await this.api.getProfile()).emailAddress;
      this.auth.setEmail(email);
    }
    await this.loadLocal(email);
    this.set({ phase: 'ready', demo: false, email, needsReconnect: this.auth.needsReconnect });
  }

  async startDemo() {
    localStorage.setItem(DEMO_KEY, '1');
    this.api = new DemoGmailClient();
    await LocalStore.destroy('demo');
    await this.loadLocal('demo');
    this.set({ phase: 'ready', demo: true, email: 'demo@gmail.com' });
    await this.sync();
  }

  private async loadLocal(account: string) {
    this.local?.close();
    this.local = await LocalStore.open(account);
    const [messages, overrides, lastSync, lastLabelApply, labelIds, dismissed] = await Promise.all([
      this.local.getAllMessages(),
      this.local.getAllOverrides(),
      this.local.get<number>('lastSync'),
      this.local.get<number>('lastLabelApply'),
      this.local.get<Record<string, string>>('labelIds'),
      this.local.get<string[]>('dismissed'),
    ]);
    this.recompute({
      messages: new Map(messages.map((m) => [m.id, m])),
      overrides: new Map(overrides.map((o) => [o.key, o])),
      lastSync,
      lastLabelApply,
      labelIds: labelIds ?? {},
      dismissed: new Set(dismissed ?? []),
    });
  }

  async signOut() {
    const wasDemo = this.state.demo;
    this.local?.close();
    this.local = undefined;
    this.api = undefined;
    if (wasDemo) {
      localStorage.removeItem(DEMO_KEY);
      await LocalStore.destroy('demo');
    } else {
      this.auth?.signOut();
    }
    this.state = { ...initialState(), toasts: this.state.toasts };
    await this.init();
  }

  async resetCache() {
    if (!this.local) return;
    await this.local.clearMessages();
    this.recompute({ messages: new Map() });
    await this.sync();
  }

  // -------------------------------------------------------------------------
  // Outils internes
  // -------------------------------------------------------------------------

  toast(text: string, kind: Toast['kind'] = 'info') {
    const t = { id: ++this.toastSeq, text, kind };
    this.set({ toasts: [...this.state.toasts, t] });
    setTimeout(() => this.set({ toasts: this.state.toasts.filter((x) => x.id !== t.id) }), kind === 'error' ? 6000 : 3500);
  }

  private async run<T>(label: string, fn: (progress: ProgressFn) => Promise<T>): Promise<T | undefined> {
    if (!this.api) return undefined;
    if (this.state.busy) {
      this.toast('Une opération est déjà en cours, patiente un instant.', 'info');
      return undefined;
    }
    this.set({ busy: { label, done: 0, total: 0 } });
    try {
      return await fn((done, total, l) => this.set({ busy: { label: l ?? this.state.busy?.label ?? label, done, total } }));
    } catch (e) {
      if (e instanceof ReauthRequiredError) this.set({ needsReconnect: true });
      this.toast(errorText(e), 'error');
      return undefined;
    } finally {
      this.set({ busy: null });
    }
  }

  private async saveOverride(o: SenderOverride) {
    const overrides = new Map(this.state.overrides);
    overrides.set(o.key, o);
    await this.local?.putOverride(o);
    this.recompute({ overrides });
  }

  private overrideFor(key: string): SenderOverride {
    return this.state.overrides.get(key) ?? { key, status: 'neutral', filterIds: [] };
  }

  private async updateMessages(updated: MessageMeta[]) {
    if (!updated.length) return;
    const messages = new Map(this.state.messages);
    for (const m of updated) messages.set(m.id, m);
    await this.local?.putMessages(updated);
    this.recompute({ messages });
  }

  // -------------------------------------------------------------------------
  // Synchronisation
  // -------------------------------------------------------------------------

  sync() {
    return this.run('Synchronisation', async (progress) => {
      const api = this.api!;
      const limit = this.state.settings.syncLimit;
      progress(0, 0, 'Liste des mails…');
      const ids = await api.listMessageIds('', limit, (d) => progress(d, limit, 'Liste des mails…'));
      const idSet = new Set(ids);

      const missing = ids.filter((id) => !this.state.messages.has(id));
      const fresh = await api.getMessagesMetadata(missing, (d, t) => progress(d, t, 'Lecture des expéditeurs…'));

      // Statut lu / non lu des mails déjà en cache (une seule requête légère).
      progress(0, 0, 'Mise à jour des mails lus…');
      const unread = new Set(await api.listMessageIds('is:unread', limit));

      const messages = new Map<string, MessageMeta>();
      const changed: MessageMeta[] = [...fresh];
      for (const [id, m] of this.state.messages) {
        if (!idSet.has(id)) continue;
        const isUnread = unread.has(id);
        if (isUnread !== m.labelIds.includes('UNREAD')) {
          const updated = {
            ...m,
            labelIds: isUnread ? [...m.labelIds, 'UNREAD'] : m.labelIds.filter((l) => l !== 'UNREAD'),
          };
          messages.set(id, updated);
          changed.push(updated);
        } else {
          messages.set(id, m);
        }
      }
      for (const m of fresh) messages.set(m.id, m);

      const stale = [...this.state.messages.keys()].filter((id) => !idSet.has(id));
      await this.local?.deleteMessages(stale);
      await this.local?.putMessages(changed);
      const lastSync = Date.now();
      await this.local?.set('lastSync', lastSync);
      this.recompute({ messages, lastSync });
      this.toast(
        fresh.length ? `${fresh.length.toLocaleString('fr-FR')} nouveaux mails analysés` : 'Boîte à jour',
        'ok',
      );
      return true;
    }).then(async (ok) => {
      if (ok && this.state.settings.autoApplyLabels && this.state.messages.size) await this.applyLabels(true);
    });
  }

  // -------------------------------------------------------------------------
  // Libellés « MailSort/… » et filtres de tri
  // -------------------------------------------------------------------------

  private async ensureLabels(): Promise<{ byCategory: Record<CategoryId, string>; allowed: string }> {
    const api = this.api!;
    const existing = new Map((await api.listLabels()).map((l) => [l.name, l.id]));
    const ensure = async (name: string) => existing.get(name) ?? (await api.createLabel(name)).id;

    await ensure(LABEL_PREFIX); // parent, pour l'affichage en sous-libellés dans Gmail
    const byCategory = {} as Record<CategoryId, string>;
    const labelIds: Record<string, string> = {};
    for (const c of CATEGORIES) {
      const name = categoryLabelName(c.id);
      byCategory[c.id] = await ensure(name);
      labelIds[name] = byCategory[c.id];
    }
    const allowed = await ensure(ALLOWED_LABEL_NAME);
    labelIds[ALLOWED_LABEL_NAME] = allowed;
    await this.local?.set('labelIds', labelIds);
    this.set({ labelIds });
    return { byCategory, allowed };
  }

  /** Pose le bon libellé MailSort sur chaque mail (et retire l'ancien si la catégorie a changé). */
  applyLabels(quiet = false) {
    return this.run('Libellés Gmail', async (progress) => {
      progress(0, 0, 'Préparation des libellés…');
      const { byCategory } = await this.ensureLabels();
      const allCatIds = Object.values(byCategory);
      const changed = await this.relabel(this.state.groups, byCategory, allCatIds, progress);

      if (this.state.settings.autoFilters) {
        progress(0, 0, 'Filtres pour les prochains mails…');
        await this.syncCategoryFilters(byCategory);
      }
      const lastLabelApply = Date.now();
      await this.local?.set('lastLabelApply', lastLabelApply);
      this.set({ lastLabelApply });
      if (!quiet || changed) {
        this.toast(changed ? `${changed.toLocaleString('fr-FR')} mails rangés dans Gmail` : 'Libellés Gmail à jour', 'ok');
      }
    });
  }

  private async relabel(
    groups: SenderGroup[],
    byCategory: Record<CategoryId, string>,
    allCatIds: string[],
    progress?: ProgressFn,
  ): Promise<number> {
    const api = this.api!;
    const toModify = new Map<CategoryId, MessageMeta[]>();
    for (const g of groups) {
      const target = byCategory[g.category];
      for (const id of g.messageIds) {
        const m = this.state.messages.get(id);
        if (!m) continue;
        const ok = m.labelIds.includes(target) && !m.labelIds.some((l) => l !== target && allCatIds.includes(l));
        if (ok) continue;
        const list = toModify.get(g.category);
        if (list) list.push(m);
        else toModify.set(g.category, [m]);
      }
    }
    const total = [...toModify.values()].reduce((s, l) => s + l.length, 0);
    let done = 0;
    const updated: MessageMeta[] = [];
    for (const [cat, msgs] of toModify) {
      const target = byCategory[cat];
      const others = allCatIds.filter((l) => l !== target);
      await api.batchModify(
        msgs.map((m) => m.id),
        [target],
        others,
        (d) => progress?.(done + d, total, `Rangement dans Gmail…`),
      );
      done += msgs.length;
      for (const m of msgs) {
        updated.push({ ...m, labelIds: [...m.labelIds.filter((l) => !others.includes(l) && l !== target), target] });
      }
    }
    await this.updateMessages(updated);
    return total;
  }

  private async syncCategoryFilters(byCategory: Record<CategoryId, string>) {
    const api = this.api!;
    const catIds = new Set(Object.values(byCategory));
    const wanted = buildCategoryFilters(this.state.groups, byCategory);
    const mine = (await api.listFilters()).filter((f) => isCategoryFilter(f, catIds));
    for (const f of mine) {
      if (f.id && !wanted.some((w) => sameFilter(w, f))) await api.deleteFilter(f.id);
    }
    for (const w of wanted) {
      if (!mine.some((f) => sameFilter(w, f))) await api.createFilter(w);
    }
  }

  private scheduleFilterSync() {
    if (!this.state.settings.autoFilters || !this.state.lastLabelApply) return;
    clearTimeout(this.filterSyncTimer);
    this.filterSyncTimer = setTimeout(() => {
      if (this.state.busy) return this.scheduleFilterSync();
      void this.run('Filtres Gmail', async (progress) => {
        progress(0, 0, 'Mise à jour des filtres de tri…');
        const { byCategory } = await this.ensureLabels();
        await this.syncCategoryFilters(byCategory);
      });
    }, 4000);
  }

  // -------------------------------------------------------------------------
  // Actions sur un expéditeur
  // -------------------------------------------------------------------------

  /** Déplace un expéditeur dans une autre catégorie : mémorisé et répercuté dans Gmail. */
  async moveToCategory(key: string, category: CategoryId) {
    const g = this.state.groupsByKey.get(key);
    if (!g || g.category === category) return;
    const o = this.overrideFor(key);
    await this.saveOverride({ ...o, category: category === g.autoCategory ? undefined : category });
    this.toast(`${g.name} → ${CATEGORY_BY_ID[category].label}`, 'ok');

    if (this.state.lastLabelApply) {
      await this.run('Libellés Gmail', async (progress) => {
        const { byCategory } = await this.ensureLabels();
        const moved = this.state.groupsByKey.get(key);
        if (moved) await this.relabel([moved], byCategory, Object.values(byCategory), progress);
      });
      this.scheduleFilterSync();
    }
  }

  /** Autoriser / bloquer / neutre, avec les vrais filtres Gmail correspondants. */
  setStatus(key: string, status: SenderStatus) {
    const g = this.state.groupsByKey.get(key);
    const name = g?.name ?? this.state.overrides.get(key)?.name ?? key;
    // Sans mail en cache, on peut seulement repasser en neutre (supprimer le filtre).
    if (!g && status !== 'neutral') return Promise.resolve(undefined);
    return this.run(status === 'blocked' ? 'Blocage' : status === 'allowed' ? 'Autorisation' : 'Mise à jour', async () => {
      const api = this.api!;
      const o = this.overrideFor(key);
      for (const id of o.filterIds) await api.deleteFilter(id);
      const filterIds: string[] = [];
      if (status === 'blocked' && g) {
        const f = await api.createFilter(buildBlockFilter(g));
        if (f.id) filterIds.push(f.id);
      } else if (status === 'allowed' && g) {
        const { allowed } = await this.ensureLabels();
        const f = await api.createFilter(buildAllowFilter(g, allowed));
        if (f.id) filterIds.push(f.id);
      }
      await this.saveOverride({ ...o, name, status, filterIds });
      this.toast(
        status === 'blocked'
          ? `${name} est bloqué : ses prochains mails iront à la corbeille`
          : status === 'allowed'
            ? `${name} est autorisé`
            : `${name} est de nouveau neutre`,
        'ok',
      );
    }).then((r) => {
      this.scheduleFilterSync();
      return r;
    });
  }

  /**
   * Désinscription en un bouton. À appeler depuis un toucher : si l'expéditeur ne
   * propose qu'une page web, elle s'ouvre tout de suite (sinon Safari la bloquerait).
   */
  unsubscribe(key: string) {
    const g = this.state.groupsByKey.get(key);
    const info = g && parseListUnsubscribe(g.listUnsubscribe, g.listUnsubscribePost);
    if (!g || !info) {
      this.toast("Cet expéditeur ne propose pas de désinscription. Tu peux le bloquer à la place.", 'info');
      return Promise.resolve();
    }
    const webOnly = !info.oneClick && !info.mailto && info.url;
    if (webOnly) window.open(info.url, '_blank', 'noopener');

    return this.run('Désinscription', async () => {
      if (info.oneClick && info.url) {
        // RFC 8058 : un POST suffit. La réponse est opaque (pas de CORS), on considère l'envoi réussi.
        await fetch(info.url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        });
      } else if (info.mailto) {
        await this.api!.sendRawMessage(buildUnsubscribeEmail(info.mailto));
      }
      await this.saveOverride({ ...this.overrideFor(key), unsubscribedAt: Date.now() });
      this.toast(
        webOnly
          ? `Page de désinscription ${de(g.name)} ouverte : termine là-bas si besoin`
          : `Désinscription envoyée à ${g.name}`,
        'ok',
      );
    });
  }

  // -------------------------------------------------------------------------
  // Nettoyage (toujours vers la corbeille)
  // -------------------------------------------------------------------------

  trash(ids: string[]) {
    return this.run('Mise à la corbeille', async (progress) => {
      await this.trashIds(ids, progress);
    });
  }

  /** Corbeille par requête Gmail (inclut les mails pas encore en cache), plus d'éventuels ids connus. */
  trashByQuery(query: string, knownIds: string[] = []) {
    return this.run('Mise à la corbeille', async (progress) => {
      progress(0, 0, 'Recherche des mails…');
      const found = await this.api!.listMessageIds(query, 20_000);
      await this.trashIds([...new Set([...knownIds, ...found])], progress);
    });
  }

  private async trashIds(ids: string[], progress: ProgressFn) {
    if (!ids.length) {
      this.toast('Aucun mail à mettre à la corbeille', 'info');
      return;
    }
    const trashed = await this.api!.trashMessages(ids, (d, t) => progress(d, t, 'Mise à la corbeille…'));
    const size = trashed.reduce((s, id) => s + (this.state.messages.get(id)?.size ?? 0), 0);
    const messages = new Map(this.state.messages);
    for (const id of trashed) messages.delete(id);
    await this.local?.deleteMessages(trashed);
    this.recompute({ messages });
    const failed = ids.length - trashed.length;
    this.toast(
      `${trashed.length.toLocaleString('fr-FR')} mails à la corbeille${size ? ` · ${formatBytes(size)} libérés` : ''}` +
        (failed ? ` (${failed} en échec, réessaie)` : ''),
      failed ? 'error' : 'ok',
    );
  }

  async dismissSuggestion(id: string) {
    const dismissed = new Set(this.state.dismissed).add(id);
    await this.local?.set('dismissed', [...dismissed]);
    this.set({ dismissed });
  }

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...this.state.settings, ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (patch.theme) applyTheme(patch.theme);
    this.set({ settings });
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  // Couleur de la barre d'état : suit le thème choisi (ou le système en mode auto).
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const forDark = m.media.includes('dark');
    m.content = theme === 'auto' ? (forDark ? '#000000' : '#f2f2f7') : dark ? '#000000' : '#f2f2f7';
  });
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
