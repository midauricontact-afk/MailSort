import type { GmailFilter, MessageMeta } from '../core/types';
import { ReauthRequiredError, type TokenProvider } from '../auth/googleAuth';
import { GmailApiError, toMessageMeta, type GmailApi, type GmailLabel, type Progress } from './api';
import { boundaryFromContentType, buildBatchBody, chunk, parseBatchResponse, type BatchItem } from './batch';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BATCH_URL = 'https://www.googleapis.com/batch/gmail/v1';
/** Gmail conseille 50 requêtes max par batch pour éviter les erreurs de quota. */
const BATCH_SIZE = 50;
const METADATA_HEADERS = ['From', 'Subject', 'List-Unsubscribe', 'List-Unsubscribe-Post'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Client de l'API REST Gmail, appelé directement depuis le navigateur. */
export class RealGmailClient implements GmailApi {
  /** Passe à false si le navigateur refuse l'URL batch (on fait alors des appels simples en parallèle). */
  private batchSupported = true;

  constructor(private readonly auth: TokenProvider) {}

  // -------------------------------------------------------------------------
  // Requêtes de base
  // -------------------------------------------------------------------------

  private async request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    const token = await this.auth.getToken();
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        return this.request(method, path, body, attempt + 1);
      }
      throw new GmailApiError('Pas de connexion internet', 0, { cause: e });
    }

    if (res.status === 401 && attempt === 0) {
      this.auth.invalidate();
      return this.request(method, path, body, attempt + 1);
    }
    if ((res.status === 429 || res.status >= 500 || isRateLimit403(res, await peek(res))) && attempt < 5) {
      await sleep(backoff(attempt));
      return this.request(method, path, body, attempt + 1);
    }
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) throw new ReauthRequiredError();
      throw new GmailApiError(extractError(text) || `Erreur Gmail ${res.status}`, res.status);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Envoie jusqu'à 50 sous-requêtes en une seule requête HTTP. Rejoue celles qui échouent pour quota. */
  private async batch(items: BatchItem[]): Promise<{ status: number; body: unknown }[]> {
    const results: { status: number; body: unknown }[] = new Array(items.length);
    let pending = items.map((item, index) => ({ item, index }));

    for (let attempt = 0; pending.length && attempt < 6; attempt++) {
      if (attempt > 0) await sleep(backoff(attempt - 1));
      const token = await this.auth.getToken();
      const boundary = `mailsort_${crypto.randomUUID()}`;
      const res = await fetch(BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/mixed; boundary=${boundary}`,
        },
        body: buildBatchBody(
          pending.map((p) => p.item),
          boundary,
        ),
      });
      if (res.status === 401) {
        this.auth.invalidate();
        continue;
      }
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new GmailApiError(extractError(await res.text()) || `Erreur batch ${res.status}`, res.status);

      const resBoundary = boundaryFromContentType(res.headers.get('Content-Type'));
      if (!resBoundary) throw new GmailApiError('Réponse batch illisible', res.status);
      const parsed = parseBatchResponse(await res.text(), resBoundary);
      const retry: typeof pending = [];
      for (const r of parsed) {
        const p = pending[r.index];
        if (!p) continue;
        if (r.status === 429 || r.status >= 500 || (r.status === 403 && /rate/i.test(JSON.stringify(r.body)))) {
          retry.push(p);
        } else {
          results[p.index] = { status: r.status, body: r.body };
        }
      }
      // Sous-requêtes absentes de la réponse : on les rejoue aussi.
      const answered = new Set(parsed.map((r) => r.index));
      pending.forEach((p, i) => {
        if (!answered.has(i)) retry.push(p);
      });
      pending = retry;
    }
    for (const p of pending) results[p.index] = { status: 429, body: null };
    return results;
  }

  /** Exécute des sous-requêtes par lots de 50, avec repli en appels simples si le batch est indisponible. */
  private async runMany(
    items: BatchItem[],
    onProgress?: Progress,
    concurrency = 2,
  ): Promise<{ status: number; body: unknown }[]> {
    const results: { status: number; body: unknown }[] = new Array(items.length);
    let done = 0;
    onProgress?.(0, items.length);

    if (this.batchSupported) {
      const chunks = chunk(
        items.map((item, index) => ({ item, index })),
        BATCH_SIZE,
      );
      let next = 0;
      try {
        await Promise.all(
          Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
            while (next < chunks.length) {
              const c = chunks[next++];
              const out = await this.batch(c.map((x) => x.item));
              out.forEach((r, i) => (results[c[i].index] = r));
              done += c.length;
              onProgress?.(done, items.length);
            }
          }),
        );
        return results;
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
        // TypeError = requête bloquée par le navigateur (CORS) : on bascule en appels simples.
        this.batchSupported = false;
        done = results.filter(Boolean).length;
      }
    }

    const remaining = items.map((item, index) => ({ item, index })).filter((x) => !results[x.index]);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, remaining.length) }, async () => {
        while (next < remaining.length) {
          const { item, index } = remaining[next++];
          const path = item.path.replace('/gmail/v1/users/me', '');
          try {
            const body = await this.request(item.method, path, item.body);
            results[index] = { status: 200, body };
          } catch (e) {
            if (e instanceof ReauthRequiredError) throw e;
            results[index] = { status: e instanceof GmailApiError ? e.status : 0, body: null };
          }
          done++;
          onProgress?.(done, items.length);
        }
      }),
    );
    return results;
  }

  // -------------------------------------------------------------------------
  // API publique
  // -------------------------------------------------------------------------

  getProfile() {
    return this.request<{ emailAddress: string; messagesTotal: number }>('GET', '/profile');
  }

  async listMessageIds(query: string, max: number, onProgress?: Progress): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ maxResults: String(Math.min(500, max - ids.length)) });
      if (query) params.set('q', query);
      if (pageToken) params.set('pageToken', pageToken);
      const page = await this.request<{ messages?: { id: string }[]; nextPageToken?: string }>(
        'GET',
        `/messages?${params}`,
      );
      for (const m of page.messages ?? []) ids.push(m.id);
      pageToken = page.nextPageToken;
      onProgress?.(ids.length, max);
    } while (pageToken && ids.length < max);
    return ids;
  }

  async getMessagesMetadata(ids: string[], onProgress?: Progress): Promise<MessageMeta[]> {
    const qs = new URLSearchParams({ format: 'metadata' });
    for (const h of METADATA_HEADERS) qs.append('metadataHeaders', h);
    const items: BatchItem[] = ids.map((id) => ({
      method: 'GET',
      path: `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${qs}`,
    }));
    const results = await this.runMany(items, onProgress);
    const out: MessageMeta[] = [];
    for (const r of results) {
      if (r?.status === 200 && r.body && typeof r.body === 'object') {
        out.push(toMessageMeta(r.body as Parameters<typeof toMessageMeta>[0]));
      }
    }
    return out;
  }

  async listLabels(): Promise<GmailLabel[]> {
    const res = await this.request<{ labels?: GmailLabel[] }>('GET', '/labels');
    return res.labels ?? [];
  }

  async createLabel(name: string): Promise<GmailLabel> {
    try {
      return await this.request<GmailLabel>('POST', '/labels', {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      });
    } catch (e) {
      // 409 : le libellé existe déjà (créé depuis un autre appareil, par exemple).
      if (e instanceof GmailApiError && e.status === 409) {
        const existing = (await this.listLabels()).find((l) => l.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
      }
      throw e;
    }
  }

  async batchModify(ids: string[], addLabelIds: string[], removeLabelIds: string[], onProgress?: Progress) {
    let done = 0;
    for (const c of chunk(ids, 1000)) {
      await this.request('POST', '/messages/batchModify', { ids: c, addLabelIds, removeLabelIds });
      done += c.length;
      onProgress?.(done, ids.length);
    }
  }

  async trashMessages(ids: string[], onProgress?: Progress): Promise<string[]> {
    const items: BatchItem[] = ids.map((id) => ({
      method: 'POST',
      path: `/gmail/v1/users/me/messages/${encodeURIComponent(id)}/trash`,
    }));
    const results = await this.runMany(items, onProgress);
    return ids.filter((_, i) => results[i]?.status === 200 || results[i]?.status === 404);
  }

  async listFilters(): Promise<GmailFilter[]> {
    const res = await this.request<{ filter?: GmailFilter[] }>('GET', '/settings/filters');
    return res.filter ?? [];
  }

  createFilter(filter: GmailFilter) {
    return this.request<GmailFilter>('POST', '/settings/filters', {
      criteria: filter.criteria,
      action: filter.action,
    });
  }

  async deleteFilter(id: string) {
    try {
      await this.request('DELETE', `/settings/filters/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof GmailApiError && e.status === 404) return; // déjà supprimé dans Gmail
      throw e;
    }
  }

  async sendRawMessage(raw: string) {
    await this.request('POST', '/messages/send', { raw });
  }
}

function backoff(attempt: number): number {
  return Math.min(16_000, 1000 * 2 ** attempt) + Math.random() * 500;
}

async function peek(res: Response): Promise<string> {
  if (res.status !== 403) return '';
  try {
    return await res.clone().text();
  } catch {
    return '';
  }
}

function isRateLimit403(res: Response, text: string): boolean {
  return res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/i.test(text);
}

function extractError(text: string): string | undefined {
  try {
    return (JSON.parse(text) as { error?: { message?: string } }).error?.message;
  } catch {
    return text.slice(0, 200) || undefined;
  }
}
