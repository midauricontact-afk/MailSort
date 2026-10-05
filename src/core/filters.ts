import type { CategoryId, GmailFilter, SenderGroup } from './types';

type SenderLike = Pick<SenderGroup, 'key' | 'domains' | 'emails'>;

/**
 * Termes qui identifient un expéditeur dans Gmail.
 * - Entreprise reconnue par son domaine → ses domaines (amazon.fr, amazon.com…),
 *   ce qui couvre aussi les sous-domaines (marketplace.amazon.fr).
 * - Personne ou expéditeur passant par un routeur d'e-mails → ses adresses exactes,
 *   pour ne jamais bloquer tout un domaine partagé (gmail.com, mailchimp.com…).
 */
export function senderTerms(group: SenderLike): string[] {
  const useDomains = group.key.startsWith('brand:') && group.domains.length > 0;
  const terms = useDomains ? group.domains : group.emails;
  return [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort();
}

/** Valeur du champ « De » d'un filtre Gmail : "amazon.com OR amazon.fr". */
export function senderFromCriteria(group: SenderLike): string {
  const terms = senderTerms(group);
  if (terms.length === 0) throw new Error(`Expéditeur sans adresse : ${group.key}`);
  return terms.join(' OR ');
}

export interface SearchOptions {
  olderThanMonths?: number;
  largerThanMB?: number;
  unreadOnly?: boolean;
}

/** Requête de recherche Gmail pour un expéditeur, ex. "from:(amazon.com OR amazon.fr) older_than:6m". */
export function senderSearchQuery(group: SenderLike, opts: SearchOptions = {}): string {
  const terms = senderTerms(group);
  const parts = [terms.length === 1 ? `from:${terms[0]}` : `from:(${terms.join(' OR ')})`];
  if (opts.olderThanMonths && opts.olderThanMonths > 0) parts.push(`older_than:${Math.round(opts.olderThanMonths)}m`);
  if (opts.largerThanMB && opts.largerThanMB > 0) parts.push(`larger:${opts.largerThanMB}M`);
  if (opts.unreadOnly) parts.push('is:unread');
  return parts.join(' ');
}

/** Bloquer : les prochains mails de l'expéditeur partent directement à la corbeille. */
export function buildBlockFilter(group: SenderLike): GmailFilter {
  return {
    criteria: { from: senderFromCriteria(group) },
    action: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX', 'UNREAD'] },
  };
}

/** Autoriser : les prochains mails sont marqués importants et reçoivent le libellé « MailSort/Autorisés ». */
export function buildAllowFilter(group: SenderLike, allowedLabelId: string): GmailFilter {
  return {
    criteria: { from: senderFromCriteria(group) },
    action: { addLabelIds: [allowedLabelId, 'IMPORTANT'] },
  };
}

/** Longueur max du champ « De » d'un filtre (Gmail refuse les critères trop longs). */
export const MAX_FILTER_FROM_LENGTH = 900;

/**
 * Filtres qui trient automatiquement les FUTURS mails dans les libellés MailSort.
 * Un filtre par catégorie, découpé en plusieurs s'il y a trop d'expéditeurs.
 * Les expéditeurs bloqués sont exclus (leur filtre de blocage s'en occupe).
 */
export function buildCategoryFilters(
  groups: SenderGroup[],
  labelIdByCategory: Partial<Record<CategoryId, string>>,
  maxLength = MAX_FILTER_FROM_LENGTH,
): GmailFilter[] {
  const byCategory = new Map<CategoryId, string[]>();
  for (const g of groups) {
    if (g.status === 'blocked') continue;
    if (!labelIdByCategory[g.category]) continue;
    const terms = senderTerms(g);
    if (!terms.length) continue;
    const list = byCategory.get(g.category) ?? [];
    list.push(...terms);
    byCategory.set(g.category, list);
  }

  const filters: GmailFilter[] = [];
  for (const [category, rawTerms] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const terms = [...new Set(rawTerms)].sort();
    let chunk: string[] = [];
    const flush = () => {
      if (!chunk.length) return;
      filters.push({
        criteria: { from: chunk.join(' OR ') },
        action: { addLabelIds: [labelIdByCategory[category]!] },
      });
      chunk = [];
    };
    for (const t of terms) {
      const nextLength = [...chunk, t].join(' OR ').length;
      if (chunk.length && nextLength > maxLength) flush();
      chunk.push(t);
    }
    flush();
  }
  return filters;
}

/** Un filtre existant a-t-il été créé par MailSort pour trier par catégorie ? */
export function isCategoryFilter(filter: GmailFilter, categoryLabelIds: Set<string>): boolean {
  const add = filter.action.addLabelIds ?? [];
  return add.length === 1 && categoryLabelIds.has(add[0]) && !!filter.criteria.from;
}

/** Deux filtres font-ils la même chose ? (utile pour ne pas créer de doublons) */
export function sameFilter(a: GmailFilter, b: GmailFilter): boolean {
  const norm = (f: GmailFilter) =>
    JSON.stringify({
      from: (f.criteria.from ?? '').toLowerCase().split(/\s+or\s+/).sort(),
      add: [...(f.action.addLabelIds ?? [])].sort(),
      remove: [...(f.action.removeLabelIds ?? [])].sort(),
    });
  return norm(a) === norm(b);
}
