import { describe, expect, it } from 'vitest';
import {
  buildAllowFilter,
  buildBlockFilter,
  buildCategoryFilters,
  isCategoryFilter,
  sameFilter,
  senderFromCriteria,
  senderSearchQuery,
} from '../src/core/filters';
import type { SenderGroup } from '../src/core/types';

function group(partial: Partial<SenderGroup>): SenderGroup {
  return {
    key: 'brand:amazon',
    name: 'Amazon',
    domains: ['amazon.fr', 'amazon.com'],
    emails: ['auto@amazon.fr', 'ship@amazon.com'],
    isPerson: false,
    category: 'shopping',
    autoCategory: 'shopping',
    status: 'neutral',
    count: 2,
    size: 0,
    unreadCount: 0,
    oldest: 0,
    newest: 0,
    messageIds: [],
    ...partial,
  };
}

describe('critères expéditeur', () => {
  it('utilise les domaines pour une entreprise', () => {
    expect(senderFromCriteria(group({}))).toBe('amazon.com OR amazon.fr');
  });

  it("utilise l'adresse exacte pour une personne (jamais tout gmail.com)", () => {
    const g = group({ key: 'person:alice@gmail.com', domains: [], emails: ['alice@gmail.com'], isPerson: true });
    expect(senderFromCriteria(g)).toBe('alice@gmail.com');
  });

  it("utilise les adresses quand l'expéditeur passe par un routeur d'e-mails", () => {
    const g = group({ key: 'name:ma-boutique', domains: ['mailchimpapp.net'], emails: ['bounce@mailchimpapp.net'] });
    expect(senderFromCriteria(g)).toBe('bounce@mailchimpapp.net');
  });

  it('refuse un expéditeur sans adresse', () => {
    expect(() => senderFromCriteria(group({ key: 'person:x', domains: [], emails: [] }))).toThrow();
  });
});

describe('requêtes de recherche', () => {
  it('construit une requête Gmail avec ancienneté', () => {
    expect(senderSearchQuery(group({}), { olderThanMonths: 6 })).toBe('from:(amazon.com OR amazon.fr) older_than:6m');
  });
  it('gère un seul terme, la taille et les non lus', () => {
    const g = group({ key: 'person:a@b.fr', domains: [], emails: ['a@b.fr'] });
    expect(senderSearchQuery(g, { largerThanMB: 5, unreadOnly: true })).toBe('from:a@b.fr larger:5M is:unread');
  });
});

describe('filtres de blocage et d’autorisation', () => {
  it('bloquer envoie les futurs mails à la corbeille (jamais de suppression définitive)', () => {
    const f = buildBlockFilter(group({}));
    expect(f).toEqual({
      criteria: { from: 'amazon.com OR amazon.fr' },
      action: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX', 'UNREAD'] },
    });
  });

  it('autoriser ajoute le libellé MailSort/Autorisés et Important', () => {
    const f = buildAllowFilter(group({}), 'Label_42');
    expect(f.action.addLabelIds).toEqual(['Label_42', 'IMPORTANT']);
    expect(f.criteria.from).toBe('amazon.com OR amazon.fr');
  });
});

describe('filtres de catégories (tri des futurs mails)', () => {
  const labels = { shopping: 'L_shop', social: 'L_social' } as const;

  it('crée un filtre par catégorie et ignore les expéditeurs bloqués', () => {
    const filters = buildCategoryFilters(
      [
        group({}),
        group({ key: 'brand:fnac', domains: ['fnac.com'], emails: ['news@fnac.com'] }),
        group({ key: 'brand:instagram', domains: ['instagram.com'], emails: [], category: 'social' }),
        group({ key: 'brand:temu', domains: ['temu.com'], emails: [], status: 'blocked' }),
        group({ key: 'brand:sncf', domains: ['sncf.fr'], emails: [], category: 'travel' }),
      ],
      labels,
    );
    expect(filters).toEqual([
      { criteria: { from: 'amazon.com OR amazon.fr OR fnac.com' }, action: { addLabelIds: ['L_shop'] } },
      { criteria: { from: 'instagram.com' }, action: { addLabelIds: ['L_social'] } },
    ]);
  });

  it('découpe en plusieurs filtres quand la liste est trop longue', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      group({ key: `brand:shop${i}`, domains: [`boutique-numero-${i}.fr`], emails: [] }),
    );
    const filters = buildCategoryFilters(many, labels, 120);
    expect(filters.length).toBeGreaterThan(1);
    for (const f of filters) expect(f.criteria.from!.length).toBeLessThanOrEqual(120);
    const all = filters.flatMap((f) => f.criteria.from!.split(' OR '));
    expect(all).toHaveLength(30);
  });

  it('reconnaît ses propres filtres', () => {
    const ids = new Set(['L_shop']);
    expect(isCategoryFilter({ criteria: { from: 'a.fr' }, action: { addLabelIds: ['L_shop'] } }, ids)).toBe(true);
    expect(isCategoryFilter({ criteria: { from: 'a.fr' }, action: { addLabelIds: ['TRASH'] } }, ids)).toBe(false);
  });

  it('compare deux filtres sans tenir compte de l’ordre', () => {
    expect(
      sameFilter(
        { criteria: { from: 'b.fr OR a.fr' }, action: { addLabelIds: ['X'] } },
        { criteria: { from: 'a.fr OR b.fr' }, action: { addLabelIds: ['X'] } },
      ),
    ).toBe(true);
  });
});
