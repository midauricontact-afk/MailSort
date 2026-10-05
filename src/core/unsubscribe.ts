export interface MailtoTarget {
  address: string;
  subject: string;
  body: string;
}

export interface UnsubscribeInfo {
  mailto?: MailtoTarget;
  url?: string;
  /** Désinscription « en un clic » (RFC 8058) : un simple POST suffit. */
  oneClick: boolean;
}

/**
 * Lit les en-têtes List-Unsubscribe / List-Unsubscribe-Post.
 * Ex. `<mailto:unsub@x.com?subject=stop>, <https://x.com/u/123>`
 */
export function parseListUnsubscribe(header?: string, postHeader?: string): UnsubscribeInfo | null {
  if (!header) return null;
  const candidates = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
  if (candidates.length === 0) candidates.push(...header.split(',').map((s) => s.trim()));

  const info: UnsubscribeInfo = { oneClick: false };
  for (const c of candidates) {
    if (!info.mailto && /^mailto:/i.test(c)) info.mailto = parseMailto(c) ?? undefined;
    else if (!info.url && /^https:\/\//i.test(c)) info.url = c;
  }
  if (!info.mailto && !info.url) return null;
  info.oneClick = !!info.url && /list-unsubscribe\s*=\s*one-click/i.test(postHeader ?? '');
  return info;
}

export function parseMailto(uri: string): MailtoTarget | null {
  const m = uri.match(/^mailto:([^?]*)(?:\?(.*))?$/i);
  if (!m) return null;
  const address = safeDecode(m[1]).trim();
  if (!address.includes('@')) return null;
  const params = new URLSearchParams(m[2] ?? '');
  return {
    address,
    subject: params.get('subject') ?? 'unsubscribe',
    body: params.get('body') ?? 'unsubscribe',
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Mail de désinscription au format RFC 2822, encodé en base64url pour l'API Gmail (messages.send). */
export function buildUnsubscribeEmail(target: MailtoTarget): string {
  const lines = [
    `To: ${target.address}`,
    `Subject: ${encodeHeader(target.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    target.body,
  ];
  return base64UrlEncode(lines.join('\r\n'));
}

function encodeHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?UTF-8?B?${base64Encode(s)}?=`;
}

function base64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64UrlEncode(s: string): string {
  return base64Encode(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
