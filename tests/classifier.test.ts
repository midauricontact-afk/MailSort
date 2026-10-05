import { describe, expect, it } from 'vitest';
import { classifyGroup, groupMessages, identifySender, type ClassifyInput } from '../src/core/classifier';
import { parseFrom, registrableDomain, isAutomatedAddress } from '../src/core/domain';
import type { MessageMeta, SenderOverride } from '../src/core/types';

let seq = 0;
function msg(from: string, extra: Partial<MessageMeta> = {}): MessageMeta {
  const { name, email } = parseFrom(from);
  return {
    id: `m${++seq}`,
    threadId: `t${seq}`,
    fromEmail: email,
    fromName: name,
    subject: '',
    date: Date.UTC(2026, 0, 1),
    size: 10_000,
    labelIds: ['INBOX'],
    ...extra,
  };
}

function input(partial: Partial<ClassifyInput>): ClassifyInput {
  return {
    brand: 'inconnu',
    isPerson: false,
    registrable: 'inconnu.fr',
    names: [],
    emails: [],
    subjects: [],
    unsubscribeRatio: 0,
    gmailCategories: {},
    count: 1,
    ...partial,
  };
}

describe('parseFrom', () => {
  it('lit un nom entre guillemets et une adresse', () => {
    expect(parseFrom('"Amazon.fr" <Commande@Amazon.fr>')).toEqual({ name: 'Amazon.fr', email: 'commande@amazon.fr' });
  });
  it('lit une adresse seule', () => {
    expect(parseFrom('news@zalando.fr')).toEqual({ name: '', email: 'news@zalando.fr' });
  });
  it('lit un nom sans guillemets', () => {
    expect(parseFrom('Jean Dupont <jean.dupont@gmail.com>')).toEqual({ name: 'Jean Dupont', email: 'jean.dupont@gmail.com' });
  });
});

describe('registrableDomain', () => {
  it('retire les sous-domaines', () => {
    expect(registrableDomain('marketplace.amazon.fr')).toBe('amazon.fr');
    expect(registrableDomain('email.mg.zalando.fr')).toBe('zalando.fr');
  });
  it('gère les suffixes à deux niveaux', () => {
    expect(registrableDomain('news.bbc.co.uk')).toBe('bbc.co.uk');
    expect(registrableDomain('impots.gouv.fr')).toBe('impots.gouv.fr');
  });
});

describe('identifySender', () => {
  it('regroupe amazon.fr, amazon.com et marketplace.amazon dans « Amazon »', () => {
    const keys = ['auto@amazon.fr', 'ship@amazon.com', 'seller@marketplace.amazon.de', 'x@amzn.com'].map(
      (e) => identifySender(e, '', false).key,
    );
    expect(new Set(keys)).toEqual(new Set(['brand:amazon']));
  });

  it('reconnaît les domaines d’envoi dédiés (temuemail.com → Temu)', () => {
    expect(identifySender('temu@eu.temuemail.com', 'Temu', true).key).toBe('brand:temu');
  });

  it('sépare les personnes qui écrivent depuis gmail.com', () => {
    const a = identifySender('alice@gmail.com', 'Alice', false);
    const b = identifySender('bob@gmail.com', 'Bob', false);
    expect(a.isPerson).toBe(true);
    expect(a.key).not.toBe(b.key);
  });

  it("ne traite pas une adresse noreply d'un fournisseur grand public comme une personne", () => {
    const id = identifySender('noreply@orange.fr', 'Orange', false);
    expect(id.isPerson).toBe(false);
    expect(id.key).toBe('brand:orange');
  });

  it('regroupe par nom affiché quand le mail passe par un routeur (Mailchimp…)', () => {
    const id = identifySender('bounce@mailchimpapp.net', 'Ma Petite Boutique', true);
    expect(id.key).toBe('name:ma-petite-boutique');
  });
});

describe('classifyGroup', () => {
  it('utilise la liste des domaines connus', () => {
    expect(classifyGroup(input({ brand: 'amazon' }))).toBe('shopping');
    expect(classifyGroup(input({ brand: 'boursorama' }))).toBe('bank');
    expect(classifyGroup(input({ brand: 'instagram' }))).toBe('social');
    expect(classifyGroup(input({ brand: 'sncf' }))).toBe('travel');
    expect(classifyGroup(input({ brand: 'github' }))).toBe('services');
    expect(classifyGroup(input({ brand: 'netflix' }))).toBe('newsletters');
  });

  it('classe une personne dans Personnel', () => {
    expect(classifyGroup(input({ isPerson: true, brand: '' }))).toBe('personal');
  });

  it('reconnaît les codes et alertes de sécurité', () => {
    const cat = classifyGroup(
      input({
        subjects: ['Votre code de vérification', 'Nouvelle connexion à votre compte', 'Réinitialisation du mot de passe'],
        count: 3,
      }),
    );
    expect(cat).toBe('services');
  });

  it('reconnaît les factures', () => {
    const cat = classifyGroup(input({ subjects: ['Votre facture de mars', 'Avis d’échéance', 'Votre facture est disponible'], count: 3 }));
    expect(cat).toBe('bank');
  });

  it('reconnaît les voyages', () => {
    const cat = classifyGroup(input({ subjects: ['Confirmation de réservation – vol AF123', 'Votre carte d\'embarquement'], count: 2 }));
    expect(cat).toBe('travel');
  });

  it('reconnaît les commandes et livraisons', () => {
    const cat = classifyGroup(input({ subjects: ['Votre commande a été expédiée', 'Votre colis est livré'], count: 2 }));
    expect(cat).toBe('shopping');
  });

  it("utilise l'en-tête List-Unsubscribe pour les newsletters", () => {
    expect(classifyGroup(input({ subjects: ['Les nouveautés de la semaine'], unsubscribeRatio: 1 }))).toBe('newsletters');
  });

  it('reconnaît une promo avec un pourcentage', () => {
    expect(classifyGroup(input({ subjects: ['-50% sur tout le site', 'Soldes : dernière chance'], count: 2 }))).toBe('newsletters');
  });

  it('utilise la catégorie native de Gmail en appoint', () => {
    expect(classifyGroup(input({ gmailCategories: { CATEGORY_SOCIAL: 4 }, count: 4 }))).toBe('social');
  });

  it('tombe dans Autres sans indice', () => {
    expect(classifyGroup(input({ subjects: ['Bonjour'] }))).toBe('other');
  });
});

describe('groupMessages', () => {
  const messages = [
    msg('"Amazon.fr" <auto-confirm@amazon.fr>', { subject: 'Votre commande', size: 50_000, labelIds: ['INBOX', 'UNREAD'] }),
    msg('Amazon <ship-confirm@amazon.com>', { subject: 'Expédié', size: 30_000 }),
    msg('Amazon Marketplace <seller@marketplace.amazon.fr>', { subject: 'Message du vendeur', size: 20_000 }),
    msg('Alice <alice@gmail.com>', { subject: 'Ciao' }),
    msg('Newsletter <news@unemarque.fr>', { subject: 'Nos nouveautés', listUnsubscribe: '<https://unemarque.fr/u>' }),
  ];

  it('fusionne les domaines d’une même entreprise et cumule les stats', () => {
    const groups = groupMessages(messages);
    const amazon = groups.find((g) => g.key === 'brand:amazon')!;
    expect(amazon.name).toBe('Amazon');
    expect(amazon.count).toBe(3);
    expect(amazon.size).toBe(100_000);
    expect(amazon.unreadCount).toBe(1);
    expect(amazon.domains).toEqual(['amazon.com', 'amazon.fr']);
    expect(amazon.category).toBe('shopping');
  });

  it('respecte le choix de catégorie et le statut de l’utilisateur', () => {
    const overrides = new Map<string, SenderOverride>([
      ['brand:amazon', { key: 'brand:amazon', category: 'other', status: 'blocked', filterIds: [] }],
    ]);
    const amazon = groupMessages(messages, overrides).find((g) => g.key === 'brand:amazon')!;
    expect(amazon.category).toBe('other');
    expect(amazon.autoCategory).toBe('shopping');
    expect(amazon.status).toBe('blocked');
  });

  it('garde le dernier lien de désinscription', () => {
    const g = groupMessages(messages).find((x) => x.key === 'brand:unemarque')!;
    expect(g.listUnsubscribe).toContain('unemarque.fr/u');
    expect(g.category).toBe('newsletters');
  });

  it('détecte les adresses automatiques', () => {
    expect(isAutomatedAddress('no-reply@x.com')).toBe(true);
    expect(isAutomatedAddress('ne-pas-repondre@x.fr')).toBe(true);
    expect(isAutomatedAddress('marie.durand@gmail.com')).toBe(false);
  });
});
