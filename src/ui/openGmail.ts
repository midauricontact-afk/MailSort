export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Google ne documente pas de lien officiel vers un mail précis dans l'app Gmail iOS.
 * On propose donc plusieurs formats connus ; l'utilisateur garde celui qui marche
 * sur son iPhone (Réglages › Tester les liens Gmail).
 */
export interface LinkFormat {
  id: string;
  label: string;
  build: (value: string) => string;
}

export const MAIL_LINK_FORMATS: LinkFormat[] = [
  { id: 'cv-account1', label: 'App Gmail · format 1', build: (t) => `googlegmail:///cv=${t}/accountId=1&create-new-tab` },
  { id: 'cv-plain', label: 'App Gmail · format 2', build: (t) => `googlegmail:///cv=${t}` },
  { id: 'cv-short', label: 'App Gmail · format 3', build: (t) => `googlegmail://cv=${t}` },
  { id: 'cv-account2', label: 'App Gmail · format 4 (2e compte)', build: (t) => `googlegmail:///cv=${t}/accountId=2&create-new-tab` },
  { id: 'web', label: 'Gmail sur le web', build: (t) => `https://mail.google.com/mail/u/0/#all/${t}` },
];

export const SEARCH_LINK_FORMATS: LinkFormat[] = [
  { id: 'copy', label: 'Ouvrir l’app + copier la recherche', build: () => 'googlegmail://' },
  { id: 'search-1', label: 'App Gmail · recherche format 1', build: (q) => `googlegmail:///search?q=${encodeURIComponent(q)}` },
  { id: 'search-2', label: 'App Gmail · recherche format 2', build: (q) => `googlegmail://search?q=${encodeURIComponent(q)}` },
  { id: 'web', label: 'Gmail sur le web', build: (q) => `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}` },
];

const MAIL_KEY = 'mailsort.gmailMailLink';
const SEARCH_KEY = 'mailsort.gmailSearchLink';

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getMailLinkFormat(): string {
  return read(MAIL_KEY, 'cv-account1');
}
export function getSearchLinkFormat(): string {
  return read(SEARCH_KEY, 'copy');
}
export function setMailLinkFormat(id: string) {
  localStorage.setItem(MAIL_KEY, id);
}
export function setSearchLinkFormat(id: string) {
  localStorage.setItem(SEARCH_KEY, id);
}

/** Ouvre un lien : schéma de l'app dans la même fenêtre, page web dans un nouvel onglet. */
export function openLink(url: string) {
  if (url.startsWith('https://')) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
}

/** Ouvre un mail précis (par son identifiant de conversation Gmail). */
export function openMailInGmail(threadId: string, formatId = getMailLinkFormat()) {
  const f = isIOS()
    ? MAIL_LINK_FORMATS.find((x) => x.id === formatId) ?? MAIL_LINK_FORMATS[0]
    : MAIL_LINK_FORMATS.find((x) => x.id === 'web')!;
  openLink(f.build(threadId));
}

/**
 * Ouvre Gmail sur la recherche d'un expéditeur. Renvoie true si la recherche a été
 * copiée (format « copier ») pour que l'écran l'indique.
 */
export async function openGmail(search?: string, formatId = getSearchLinkFormat()): Promise<boolean> {
  if (!isIOS()) {
    openLink(search ? SEARCH_LINK_FORMATS.find((x) => x.id === 'web')!.build(search) : 'https://mail.google.com/mail/u/0/');
    return false;
  }
  if (!search) {
    openLink('googlegmail://');
    return false;
  }
  const f = SEARCH_LINK_FORMATS.find((x) => x.id === formatId) ?? SEARCH_LINK_FORMATS[0];
  if (f.id === 'copy') {
    try {
      await navigator.clipboard.writeText(search);
    } catch {
      /* presse-papiers indisponible */
    }
  }
  openLink(f.build(search));
  return f.id === 'copy';
}
