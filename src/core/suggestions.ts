import type { MessageMeta, SenderGroup } from './types';
import { de, monthsAgo } from './format';

export type SuggestionKind = 'unsubscribe' | 'cleanOld' | 'blockedLeftovers' | 'socialNotifs' | 'bigFiles';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  groupKey?: string;
  /** Mails concernés par l'action proposée (toujours mis à la corbeille, jamais supprimés). */
  messageIds: string[];
  size: number;
  /** Proposer aussi la désinscription. */
  canUnsubscribe: boolean;
}

export const BIG_FILE_BYTES = 5 * 1024 * 1024;

/** Suggestions de nettoyage calculées localement à partir du cache. */
export function buildSuggestions(
  groups: SenderGroup[],
  messages: Map<string, MessageMeta>,
  dismissed: Set<string> = new Set(),
  now = Date.now(),
): Suggestion[] {
  const out: Suggestion[] = [];
  const sizeOf = (ids: string[]) => ids.reduce((s, id) => s + (messages.get(id)?.size ?? 0), 0);
  const sixMonths = monthsAgo(6, now);
  const oneMonth = monthsAgo(1, now);

  for (const g of groups) {
    if (g.status === 'allowed') continue;

    if (g.status === 'blocked' && g.count > 0) {
      out.push({
        id: `blocked:${g.key}`,
        kind: 'blockedLeftovers',
        title: `${g.name} est bloqué`,
        detail: `Il reste ${g.count} mail${g.count > 1 ? 's' : ''} de cet expéditeur dans ta boîte.`,
        groupKey: g.key,
        messageIds: g.messageIds,
        size: g.size,
        canUnsubscribe: false,
      });
      continue;
    }

    const readRatio = g.count ? 1 - g.unreadCount / g.count : 1;
    if (!g.isPerson && g.listUnsubscribe && !g.unsubscribedAt && g.count >= 5 && readRatio <= 0.2) {
      const never = g.unreadCount === g.count;
      out.push({
        id: `unsub:${g.key}`,
        kind: 'unsubscribe',
        title: never ? `Tu n'as jamais ouvert ${g.name}` : `Tu ouvres rarement ${g.name}`,
        detail: never
          ? `${g.count} mails jamais lus. Se désinscrire et tout mettre à la corbeille ?`
          : `Seulement ${Math.round(readRatio * 100)} % lus sur ${g.count}. Se désinscrire et faire le ménage ?`,
        groupKey: g.key,
        messageIds: g.messageIds,
        size: g.size,
        canUnsubscribe: true,
      });
      continue;
    }

    if (g.category === 'social' && g.count >= 30) {
      const ids = g.messageIds.filter((id) => (messages.get(id)?.date ?? now) < oneMonth);
      if (ids.length >= 20) {
        out.push({
          id: `social:${g.key}`,
          kind: 'socialNotifs',
          title: `Notifications ${g.name}`,
          detail: `${ids.length} notifications de plus d'un mois. Les mettre à la corbeille ?`,
          groupKey: g.key,
          messageIds: ids,
          size: sizeOf(ids),
          canUnsubscribe: false,
        });
        continue;
      }
    }

    if (g.category !== 'personal' && g.category !== 'bank' && g.count >= 20) {
      const ids = g.messageIds.filter((id) => (messages.get(id)?.date ?? now) < sixMonths);
      if (ids.length >= 15) {
        out.push({
          id: `old:${g.key}`,
          kind: 'cleanOld',
          title: `Vieux mails ${de(g.name)}`,
          detail: `${ids.length} mails de plus de 6 mois. Les mettre à la corbeille ?`,
          groupKey: g.key,
          messageIds: ids,
          size: sizeOf(ids),
          canUnsubscribe: false,
        });
      }
    }
  }

  const big = [...messages.values()].filter((m) => m.size >= BIG_FILE_BYTES);
  if (big.length) {
    out.push({
      id: 'bigfiles',
      kind: 'bigFiles',
      title: 'Grosses pièces jointes',
      detail: `${big.length} mail${big.length > 1 ? 's' : ''} de plus de 5 Mo. À vérifier dans l'onglet Stockage.`,
      messageIds: big.map((m) => m.id),
      size: big.reduce((s, m) => s + m.size, 0),
      canUnsubscribe: false,
    });
  }

  return out.filter((s) => !dismissed.has(s.id)).sort((a, b) => b.size - a.size);
}
