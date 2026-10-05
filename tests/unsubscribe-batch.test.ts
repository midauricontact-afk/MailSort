import { describe, expect, it } from 'vitest';
import { buildUnsubscribeEmail, parseListUnsubscribe } from '../src/core/unsubscribe';
import { boundaryFromContentType, buildBatchBody, parseBatchResponse } from '../src/gmail/batch';
import { buildSuggestions } from '../src/core/suggestions';
import { groupMessages } from '../src/core/classifier';
import type { MessageMeta } from '../src/core/types';

describe('List-Unsubscribe', () => {
  it('lit un lien mailto et un lien https en un clic', () => {
    const info = parseListUnsubscribe(
      '<mailto:unsub@news.fr?subject=STOP>, <https://news.fr/u?id=1>',
      'List-Unsubscribe=One-Click',
    );
    expect(info).toEqual({
      mailto: { address: 'unsub@news.fr', subject: 'STOP', body: 'unsubscribe' },
      url: 'https://news.fr/u?id=1',
      oneClick: true,
    });
  });

  it('ignore les liens http non sécurisés et les en-têtes vides', () => {
    expect(parseListUnsubscribe('<http://news.fr/u>')).toBeNull();
    expect(parseListUnsubscribe(undefined)).toBeNull();
  });

  it('construit un mail de désinscription en base64url', () => {
    const raw = buildUnsubscribeEmail({ address: 'unsub@news.fr', subject: 'Désinscription', body: 'unsubscribe' });
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(decoded).toContain('To: unsub@news.fr');
    expect(decoded).toContain('Subject: =?UTF-8?B?');
    expect(raw).not.toMatch(/[+/=]/);
  });
});

describe('batch Gmail', () => {
  it('construit le corps multipart', () => {
    const body = buildBatchBody([{ method: 'GET', path: '/gmail/v1/users/me/messages/1' }], 'b');
    expect(body).toContain('--b\r\nContent-Type: application/http\r\nContent-ID: <item0>');
    expect(body).toContain('GET /gmail/v1/users/me/messages/1 HTTP/1.1');
    expect(body.endsWith('--b--\r\n')).toBe(true);
  });

  it('lit la réponse multipart', () => {
    const boundary = boundaryFromContentType('multipart/mixed; boundary=batch_xyz')!;
    expect(boundary).toBe('batch_xyz');
    const text = [
      '--batch_xyz',
      'Content-Type: application/http',
      'Content-ID: <response-item1>',
      '',
      'HTTP/1.1 429 Too Many Requests',
      'Content-Type: application/json',
      '',
      '{"error":{"code":429}}',
      '--batch_xyz',
      'Content-Type: application/http',
      'Content-ID: <response-item0>',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"id":"abc"}',
      '--batch_xyz--',
    ].join('\r\n');
    expect(parseBatchResponse(text, boundary)).toEqual([
      { index: 0, status: 200, body: { id: 'abc' } },
      { index: 1, status: 429, body: { error: { code: 429 } } },
    ]);
  });
});

describe('suggestions', () => {
  const now = Date.UTC(2026, 9, 1);
  const mk = (i: number, extra: Partial<MessageMeta>): MessageMeta => ({
    id: `s${i}`,
    threadId: `s${i}`,
    fromEmail: 'news@promo-shop.fr',
    fromName: 'Promo Shop',
    subject: 'Offre',
    date: now - i * 86_400_000,
    size: 1000,
    labelIds: ['INBOX', 'UNREAD'],
    listUnsubscribe: '<https://promo-shop.fr/u>',
    ...extra,
  });

  it('propose de se désinscrire des newsletters jamais ouvertes', () => {
    const msgs = Array.from({ length: 6 }, (_, i) => mk(i, {}));
    const map = new Map(msgs.map((m) => [m.id, m]));
    const s = buildSuggestions(groupMessages(msgs), map, new Set(), now);
    expect(s[0].kind).toBe('unsubscribe');
    expect(s[0].title).toContain('jamais ouvert');
    expect(s[0].messageIds).toHaveLength(6);
  });

  it('ne suggère rien pour un expéditeur autorisé', () => {
    const msgs = Array.from({ length: 6 }, (_, i) => mk(i, {}));
    const map = new Map(msgs.map((m) => [m.id, m]));
    const groups = groupMessages(msgs).map((g) => ({ ...g, status: 'allowed' as const }));
    expect(buildSuggestions(groups, map, new Set(), now)).toHaveLength(0);
  });
});
