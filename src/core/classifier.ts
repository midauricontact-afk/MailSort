import type { CategoryId, MessageMeta, SenderGroup, SenderOverride } from './types';
import {
  emailDomain,
  emailLocalPart,
  isAutomatedAddress,
  normalizeText,
  registrableDomain,
  secondLevelLabel,
} from './domain';
import { BRAND_ALIASES, ESP_KEYS, KNOWN_SENDERS, capitalize, isPersonalProvider } from './knownSenders';

export interface SenderIdentity {
  /** Clé stable du groupe : "brand:amazon", "person:jean@gmail.com", "name:ma-boutique". */
  key: string;
  brand: string;
  registrable: string;
  isPerson: boolean;
}

/** Détermine à quel groupe appartient un expéditeur. */
export function identifySender(fromEmail: string, fromName: string, hasListUnsubscribe: boolean): SenderIdentity {
  const email = fromEmail.toLowerCase();
  const registrable = registrableDomain(emailDomain(email));
  const sld = secondLevelLabel(registrable);
  const brand = BRAND_ALIASES[sld] ?? sld;

  if (!registrable) {
    return { key: `person:${email || fromName.toLowerCase()}`, brand: '', registrable, isPerson: true };
  }
  if (isPersonalProvider(registrable) && !hasListUnsubscribe && !isAutomatedAddress(email)) {
    return { key: `person:${email}`, brand: '', registrable, isPerson: true };
  }
  // Domaine d'un routeur d'e-mails (Mailchimp, SendGrid…) : on se fie au nom affiché.
  if (ESP_KEYS.has(brand) && fromName.trim()) {
    const slug = normalizeText(fromName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slug) return { key: `name:${slug}`, brand: slug, registrable, isPerson: false };
  }
  return { key: `brand:${brand}`, brand, registrable, isPerson: false };
}

// ---------------------------------------------------------------------------
// Classement par règles locales
// ---------------------------------------------------------------------------

function kw(words: string[]): RegExp {
  // Les mots finissant par « * » sont des racines (expedi* → expedie, expedition…).
  // Les limites de mot ne s'appliquent qu'aux bords alphanumériques (« 50% » doit matcher « % »).
  const parts = words.map((w) => {
    const stem = w.endsWith('*');
    const word = stem ? w.slice(0, -1) : w;
    const before = /^[a-z0-9]/.test(word) ? '(?<![a-z0-9])' : '';
    const after = !stem && /[a-z0-9]$/.test(word) ? '(?![a-z0-9])' : '';
    return `${before}${escape(word)}${after}`;
  });
  return new RegExp(parts.join('|'));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORDS: Record<Exclude<CategoryId, 'personal' | 'other'>, RegExp> = {
  shopping: kw([
    'commande*', 'order*', 'livraison*', 'livre', 'livree', 'delivery', 'delivered', 'colis',
    'expedi*', 'shipped', 'shipping', 'shipment', 'panier', 'achat*', 'purchase*', 'suivi de',
    'tracking', 'retrait', 'point relais', 'shop', 'boutique', 'store', 'retour de votre',
  ]),
  bank: kw([
    'banque*', 'bank*', 'factur*', 'invoice*', 'releve*', 'statement', 'paiement*', 'payment*',
    'prelevement*', 'echeance*', 'virement*', 'solde', 'carte bancaire', 'impot*', 'assurance*',
    'mutuelle', 'quittance', 'loyer', 'pret', 'credit', 'remboursement*', 'reglement*', 'receipt',
    'recu de paiement', 'votre abonnement mobile', 'consommation',
  ]),
  social: kw([
    'a commente', 'commented', 'a aime', 'liked', 'mentioned', 'vous a mentionne', 'identifie',
    'tagged', 'friend*', 'ami', 'amis', 'follower*', 'followed', 'vous suit', 'nouvel abonne',
    'new message', 'nouveau message', 'a publie', 'posted', 'story', 'reacted', 'a reagi',
    'replied', 'a repondu', 'invitation a se connecter', 'connection request', 'live now', 'en direct',
  ]),
  newsletters: kw([
    'newsletter*', 'promo*', 'offre*', 'soldes', 'reduction*', 'remise*', '%', 'deal*', 'sale',
    'off', 'exclusi*', 'nouveaute*', 'decouvrez', 'black friday', 'cyber monday', 'gratuit*',
    'free shipping', 'weekly', 'hebdo*', 'digest', 'edition', 'bon plan*', 'jusqu\'a', 'derniere chance',
    'last chance', 'ne manquez pas', 'don\'t miss', 'actu*', 'webinar*', 'podcast',
  ]),
  services: kw([
    'code', 'verification*', 'verify', 'verifi*', 'securite', 'security', 'mot de passe', 'password',
    'connexion*', 'sign in', 'sign-in', 'signin', 'login', 'log in', '2fa', 'otp', 'confirm*',
    'activation', 'activez', 'compte', 'account', 'identifiant*', 'reinitialis*', 'reset', 'nouvel appareil',
    'new device', 'authentication', 'authentification', 'one-time', 'usage unique', 'welcome to',
    'bienvenue', 'conditions d\'utilisation', 'terms of service', 'privacy policy',
  ]),
  travel: kw([
    'vol', 'vols', 'flight*', 'reservation*', 'booking*', 'billet*', 'e-billet', 'hotel*', 'train*',
    'check-in', 'enregistrement en ligne', 'embarquement', 'boarding', 'voyage*', 'trip', 'sejour*',
    'itineraire', 'location de voiture', 'car rental', 'airport', 'aeroport', 'gare', 'depart',
    'arrivee', 'pnr', 'carte d\'embarquement', 'hebergement',
  ]),
};

export interface ClassifyInput {
  brand: string;
  isPerson: boolean;
  registrable: string;
  names: string[];
  emails: string[];
  subjects: string[];
  /** Part des mails qui ont un en-tête List-Unsubscribe (0..1). */
  unsubscribeRatio: number;
  /** Nombre de mails portant chaque catégorie native de Gmail (CATEGORY_SOCIAL…). */
  gmailCategories: Record<string, number>;
  count: number;
}

export function classifyGroup(input: ClassifyInput): CategoryId {
  const known = KNOWN_SENDERS.get(input.brand);
  if (known) return known.category;
  if (input.isPerson) return 'personal';

  const scores = scoreCategories(input);
  let best: CategoryId = 'other';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores) as [CategoryId, number][]) {
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  if (bestScore >= 2) return best;
  if (input.unsubscribeRatio >= 0.3) return 'newsletters';
  return 'other';
}

export function scoreCategories(input: ClassifyInput): Partial<Record<CategoryId, number>> {
  const scores: Partial<Record<CategoryId, number>> = {};
  const add = (c: CategoryId, n: number) => (scores[c] = (scores[c] ?? 0) + n);

  const identityText = normalizeText(
    [input.registrable, ...input.names, ...input.emails.map(emailLocalPart)].join(' ').replace(/[._-]/g, ' '),
  );
  const subjects = input.subjects.map(normalizeText);

  for (const [cat, re] of Object.entries(KEYWORDS) as [CategoryId, RegExp][]) {
    if (re.test(identityText)) add(cat, 2.5);
    if (subjects.length) {
      const hits = subjects.filter((s) => re.test(s)).length;
      add(cat, (hits / subjects.length) * 4);
    }
  }

  const total = Math.max(1, input.count);
  const g = input.gmailCategories;
  if (g.CATEGORY_SOCIAL) add('social', (g.CATEGORY_SOCIAL / total) * 3);
  if (g.CATEGORY_PROMOTIONS) add('newsletters', (g.CATEGORY_PROMOTIONS / total) * 2.5);
  if (g.CATEGORY_FORUMS) add('newsletters', (g.CATEGORY_FORUMS / total) * 1);
  if (input.unsubscribeRatio > 0) add('newsletters', input.unsubscribeRatio * 2);

  return scores;
}

// ---------------------------------------------------------------------------
// Regroupement
// ---------------------------------------------------------------------------

const GMAIL_CATEGORY_LABELS = ['CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'];

interface Accumulator {
  identity: SenderIdentity;
  domains: Set<string>;
  emails: Set<string>;
  nameCounts: Map<string, number>;
  messages: MessageMeta[];
  size: number;
  unread: number;
  unsubCount: number;
  gmailCategories: Record<string, number>;
  oldest: number;
  newest: number;
  latestUnsub?: MessageMeta;
}

/** Regroupe les mails par entreprise / personne et applique les choix de l'utilisateur. */
export function groupMessages(
  messages: Iterable<MessageMeta>,
  overrides: Map<string, SenderOverride> = new Map(),
): SenderGroup[] {
  const acc = new Map<string, Accumulator>();

  for (const m of messages) {
    const identity = identifySender(m.fromEmail, m.fromName, !!m.listUnsubscribe);
    let a = acc.get(identity.key);
    if (!a) {
      a = {
        identity,
        domains: new Set(),
        emails: new Set(),
        nameCounts: new Map(),
        messages: [],
        size: 0,
        unread: 0,
        unsubCount: 0,
        gmailCategories: {},
        oldest: Infinity,
        newest: 0,
      };
      acc.set(identity.key, a);
    }
    if (!identity.isPerson && identity.registrable) a.domains.add(identity.registrable);
    if (m.fromEmail) a.emails.add(m.fromEmail.toLowerCase());
    const name = m.fromName.trim();
    if (name) a.nameCounts.set(name, (a.nameCounts.get(name) ?? 0) + 1);
    a.messages.push(m);
    a.size += m.size;
    if (m.labelIds.includes('UNREAD')) a.unread++;
    if (m.listUnsubscribe) {
      a.unsubCount++;
      if (!a.latestUnsub || m.date > a.latestUnsub.date) a.latestUnsub = m;
    }
    for (const l of GMAIL_CATEGORY_LABELS) {
      if (m.labelIds.includes(l)) a.gmailCategories[l] = (a.gmailCategories[l] ?? 0) + 1;
    }
    a.oldest = Math.min(a.oldest, m.date);
    a.newest = Math.max(a.newest, m.date);
  }

  const groups: SenderGroup[] = [];
  for (const [key, a] of acc) {
    a.messages.sort((x, y) => y.date - x.date);
    const names = [...a.nameCounts.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n);
    const autoCategory = classifyGroup({
      brand: a.identity.brand,
      isPerson: a.identity.isPerson,
      registrable: a.identity.registrable,
      names: names.slice(0, 5),
      emails: [...a.emails].slice(0, 10),
      subjects: a.messages.slice(0, 40).map((m) => m.subject),
      unsubscribeRatio: a.unsubCount / a.messages.length,
      gmailCategories: a.gmailCategories,
      count: a.messages.length,
    });
    const o = overrides.get(key);
    groups.push({
      key,
      name: displayName(a.identity, names, [...a.emails]),
      domains: [...a.domains].sort(),
      emails: [...a.emails].sort(),
      isPerson: a.identity.isPerson,
      category: o?.category ?? autoCategory,
      autoCategory,
      status: o?.status ?? 'neutral',
      count: a.messages.length,
      size: a.size,
      unreadCount: a.unread,
      oldest: a.oldest,
      newest: a.newest,
      listUnsubscribe: a.latestUnsub?.listUnsubscribe,
      listUnsubscribePost: a.latestUnsub?.listUnsubscribePost,
      messageIds: a.messages.map((m) => m.id),
      unsubscribedAt: o?.unsubscribedAt,
    });
  }
  return groups;
}

export function displayName(identity: SenderIdentity, namesByFrequency: string[], emails: string[]): string {
  const known = KNOWN_SENDERS.get(identity.brand);
  if (known) return known.name;
  const best = namesByFrequency.find((n) => n.length > 0 && n.length <= 40 && !n.includes('@'));
  if (identity.isPerson) return best ?? emails[0] ?? 'Inconnu';
  if (best) return best;
  return capitalize(identity.brand || emails[0] || 'Inconnu');
}
