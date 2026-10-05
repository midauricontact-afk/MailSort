import type { SenderGroup } from '../core/types';
import { senderSearchQuery } from '../core/filters';
import { de, formatBytes, monthsAgo } from '../core/format';
import { store } from '../state/store';
import type { UI } from './uiContext';

/** Estimation à partir du cache local : nombre de mails et espace occupé. */
export function estimate(group: SenderGroup, olderThanMonths?: number) {
  const limit = olderThanMonths ? monthsAgo(olderThanMonths) : Infinity;
  let count = 0;
  let size = 0;
  const ids: string[] = [];
  for (const id of group.messageIds) {
    const m = store.state.messages.get(id);
    if (!m || m.date >= limit) continue;
    count++;
    size += m.size;
    ids.push(id);
  }
  return { count, size, ids };
}

/** Mettre à la corbeille les mails d'un expéditeur (éventuellement seulement les plus vieux). */
export async function trashSender(ui: UI, g: SenderGroup, olderThanMonths?: number) {
  const est = estimate(g, olderThanMonths);
  const scope = olderThanMonths ? `de plus de ${olderThanMonths} mois ` : '';
  const choice = await ui.ask({
    title: `Corbeille : ${g.name}`,
    message:
      `Tous les mails ${scope}${de(g.name)} iront dans la corbeille de Gmail` +
      ` (environ ${est.count.toLocaleString('fr-FR')} mails, ${formatBytes(est.size)} libérés).` +
      `\n\nIls restent récupérables 30 jours dans la corbeille, puis Gmail les efface.`,
    actions: [
      { id: 'cancel', label: 'Annuler', style: 'cancel' },
      { id: 'ok', label: 'Mettre à la corbeille', style: 'destructive' },
    ],
  });
  if (choice !== 'ok') return;
  await store.trashByQuery(senderSearchQuery(g, { olderThanMonths }), est.ids);
}

export async function blockSender(ui: UI, g: SenderGroup) {
  const choice = await ui.ask({
    title: `Bloquer ${g.name} ?`,
    message:
      `Un filtre Gmail enverra ses prochains mails directement à la corbeille.` +
      (g.count ? `\n\nMettre aussi les ${g.count.toLocaleString('fr-FR')} mails actuels (${formatBytes(g.size)}) à la corbeille ?` : ''),
    actions: [
      ...(g.count ? [{ id: 'block-clean', label: 'Bloquer et tout mettre à la corbeille', style: 'destructive' as const }] : []),
      { id: 'block', label: 'Bloquer', style: g.count ? ('default' as const) : ('destructive' as const) },
      { id: 'cancel', label: 'Annuler', style: 'cancel' },
    ],
  });
  if (!choice) return;
  await store.setStatus(g.key, 'blocked');
  if (choice === 'block-clean') await store.trashByQuery(senderSearchQuery(g), g.messageIds);
}

export async function allowSender(g: SenderGroup) {
  await store.setStatus(g.key, 'allowed');
}

export async function neutralSender(g: SenderGroup) {
  await store.setStatus(g.key, 'neutral');
}

/** Désinscription immédiate (au toucher), puis proposition de faire le ménage. */
export async function unsubscribeSender(ui: UI, g: SenderGroup) {
  await store.unsubscribe(g.key);
  const fresh = store.state.groupsByKey.get(g.key);
  if (!fresh?.unsubscribedAt || !fresh.count) return;
  const choice = await ui.ask({
    title: 'Faire le ménage aussi ?',
    message: `Mettre les ${fresh.count.toLocaleString('fr-FR')} mails ${de(fresh.name)} (${formatBytes(fresh.size)}) à la corbeille ?`,
    actions: [
      { id: 'cancel', label: 'Non merci', style: 'cancel' },
      { id: 'ok', label: 'Corbeille', style: 'destructive' },
    ],
  });
  if (choice === 'ok') await store.trashByQuery(senderSearchQuery(fresh), fresh.messageIds);
}
