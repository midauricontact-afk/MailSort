import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'shopping', label: 'Achats & livraisons', emoji: '🛍️', color: '#f59e0b' },
  { id: 'bank', label: 'Banque & factures', emoji: '🏦', color: '#10b981' },
  { id: 'social', label: 'Réseaux sociaux', emoji: '💬', color: '#3b82f6' },
  { id: 'newsletters', label: 'Newsletters & promos', emoji: '📣', color: '#ec4899' },
  { id: 'services', label: 'Services & comptes', emoji: '🔐', color: '#8b5cf6' },
  { id: 'travel', label: 'Voyages', emoji: '✈️', color: '#06b6d4' },
  { id: 'personal', label: 'Personnel', emoji: '👤', color: '#ef4444' },
  { id: 'other', label: 'Autres', emoji: '📁', color: '#6b7280' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryInfo
>;

export const LABEL_PREFIX = 'MailSort';

/** Nom du libellé Gmail d'une catégorie, ex. « MailSort/Achats & livraisons ». */
export function categoryLabelName(id: CategoryId): string {
  return `${LABEL_PREFIX}/${CATEGORY_BY_ID[id].label}`;
}

export const ALLOWED_LABEL_NAME = `${LABEL_PREFIX}/Autorisés`;
