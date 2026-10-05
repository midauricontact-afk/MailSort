import { parseFrom } from '../core/domain';
import type { GmailFilter, MessageMeta } from '../core/types';

export interface GmailLabel {
  id: string;
  name: string;
  type?: 'system' | 'user';
}

export type Progress = (done: number, total: number) => void;

/** Tout ce que MailSort fait sur le compte Gmail. Implémenté par l'API réelle et par le mode démo. */
export interface GmailApi {
  getProfile(): Promise<{ emailAddress: string; messagesTotal: number }>;
  /** Liste les identifiants des mails (hors corbeille et spam), du plus récent au plus ancien. */
  listMessageIds(query: string, max: number, onProgress?: Progress): Promise<string[]>;
  getMessagesMetadata(ids: string[], onProgress?: Progress): Promise<MessageMeta[]>;
  listLabels(): Promise<GmailLabel[]>;
  createLabel(name: string): Promise<GmailLabel>;
  batchModify(ids: string[], addLabelIds: string[], removeLabelIds: string[], onProgress?: Progress): Promise<void>;
  /** Met à la corbeille (récupérable 30 jours). MailSort ne supprime JAMAIS définitivement. */
  trashMessages(ids: string[], onProgress?: Progress): Promise<string[]>;
  listFilters(): Promise<GmailFilter[]>;
  createFilter(filter: GmailFilter): Promise<GmailFilter>;
  deleteFilter(id: string): Promise<void>;
  sendRawMessage(raw: string): Promise<void>;
}

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GmailApiError';
  }
}

/** Convertit une ressource Message de l'API (format=metadata) en métadonnées MailSort. */
export function toMessageMeta(raw: {
  id: string;
  threadId: string;
  internalDate?: string;
  sizeEstimate?: number;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}): MessageMeta {
  const headers = new Map<string, string>();
  for (const h of raw.payload?.headers ?? []) headers.set(h.name.toLowerCase(), h.value);
  return {
    id: raw.id,
    threadId: raw.threadId,
    ...splitFrom(headers.get('from') ?? ''),
    subject: headers.get('subject') ?? '',
    date: Number(raw.internalDate ?? 0),
    size: raw.sizeEstimate ?? 0,
    labelIds: raw.labelIds ?? [],
    listUnsubscribe: headers.get('list-unsubscribe') || undefined,
    listUnsubscribePost: headers.get('list-unsubscribe-post') || undefined,
  };
}

function splitFrom(header: string) {
  const { name, email } = parseFrom(header);
  return { fromEmail: email, fromName: name };
}
