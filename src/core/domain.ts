/** Suffixes publics à deux niveaux les plus courants (liste volontairement courte). */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp',
  'ne.jp', 'or.jp', 'co.kr', 'com.br', 'com.mx', 'com.ar', 'co.in', 'com.tr', 'com.cn', 'com.hk',
  'com.sg', 'com.tw', 'co.za', 'co.il', 'com.pl', 'com.es', 'gouv.fr', 'asso.fr', 'nom.fr',
  'com.pt', 'com.ua', 'co.id', 'co.th', 'com.my', 'com.ph', 'com.vn', 'gc.ca', 'qc.ca',
]);

export interface ParsedFrom {
  name: string;
  email: string;
}

/** Décode un en-tête From : `"Amazon.fr" <commande@amazon.fr>`, `Nom <a@b>` ou `a@b`. */
export function parseFrom(header: string): ParsedFrom {
  const raw = (header ?? '').trim();
  const angle = raw.match(/^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (angle) {
    return { name: cleanName(angle[1]), email: angle[2].toLowerCase() };
  }
  const bare = raw.match(/([^\s<>"]+@[^\s<>"]+)/);
  if (bare) {
    const email = bare[1].toLowerCase();
    const rest = raw.replace(bare[1], '').replace(/[()]/g, '');
    return { name: cleanName(rest), email };
  }
  return { name: cleanName(raw), email: '' };
}

function cleanName(s: string): string {
  return s
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\\"/g, '"')
    .trim();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase().replace(/\.$/, '');
}

export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? email : email.slice(0, at).toLowerCase();
}

/** marketplace.amazon.fr → amazon.fr ; news.bbc.co.uk → bbc.co.uk ; impots.gouv.fr → impots.gouv.fr */
export function registrableDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

/** Premier libellé du domaine enregistrable : amazon.fr → amazon ; bbc.co.uk → bbc. */
export function secondLevelLabel(registrable: string): string {
  return registrable.split('.')[0] ?? registrable;
}

const AUTOMATED_LOCAL =
  /(^|[._+-])(no-?reply|do-?not-?reply|ne-?pas-?repondre|nepasrepondre|noreply|mailer|newsletter|news|info|infos|notification|notifications|notify|alert|alerts|alerte|service|services|support|contact|client|clients|facture|factures|billing|compte|account|accounts|security|securite|team|equipe|hello|bonjour|marketing|promo|offres|bounce|automated|robot|updates|digest)([._+-]|$)/;

/** Adresse générée par une machine (noreply@, newsletter@…) plutôt qu'une personne. */
export function isAutomatedAddress(email: string): boolean {
  return AUTOMATED_LOCAL.test(emailLocalPart(email));
}

/** Minuscules sans accents, pour comparer des mots-clés. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
