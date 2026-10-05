export type CategoryId =
  | 'shopping'
  | 'bank'
  | 'social'
  | 'newsletters'
  | 'services'
  | 'travel'
  | 'personal'
  | 'other';

export type SenderStatus = 'allowed' | 'blocked' | 'neutral';

/** Un mail tel qu'on le garde en cache (métadonnées uniquement, jamais le contenu). */
export interface MessageMeta {
  id: string;
  threadId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  /** Horodatage en millisecondes (internalDate de Gmail). */
  date: number;
  /** Taille estimée par Gmail, en octets (pièces jointes comprises). */
  size: number;
  labelIds: string[];
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
}

/** Ce que l'utilisateur a décidé pour un expéditeur (persisté). */
export interface SenderOverride {
  key: string;
  category?: CategoryId;
  status: SenderStatus;
  /** Nom affiché au moment du choix (pour lister un expéditeur bloqué qui n'a plus de mail). */
  name?: string;
  /** Filtres Gmail créés par MailSort pour cet expéditeur (blocage / autorisation). */
  filterIds: string[];
  unsubscribedAt?: number;
}

/** Un expéditeur regroupé (entreprise, application ou personne). */
export interface SenderGroup {
  key: string;
  name: string;
  /** Domaines enregistrables (amazon.fr, amazon.com…) ; vide pour une personne. */
  domains: string[];
  emails: string[];
  /** true quand le groupe correspond à une seule adresse (ex. une personne sur gmail.com). */
  isPerson: boolean;
  category: CategoryId;
  autoCategory: CategoryId;
  status: SenderStatus;
  count: number;
  size: number;
  unreadCount: number;
  oldest: number;
  newest: number;
  /** En-tête List-Unsubscribe le plus récent trouvé. */
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  messageIds: string[];
  unsubscribedAt?: number;
}

export interface GmailFilter {
  id?: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
}
