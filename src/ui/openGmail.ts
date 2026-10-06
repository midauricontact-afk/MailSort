export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Ouvre l'application Gmail de Google (schéma googlegmail://) sur iPhone.
 * L'app Gmail ne permet pas d'ouvrir une recherche précise par lien : on copie
 * alors la recherche dans le presse-papiers pour la coller dans Gmail.
 * Hors iPhone, on ouvre Gmail sur le web directement sur la recherche.
 */
export async function openGmail(search?: string): Promise<'app' | 'web'> {
  if (search) {
    try {
      await navigator.clipboard.writeText(search);
    } catch {
      /* presse-papiers indisponible */
    }
  }
  if (isIOS()) {
    window.location.href = 'googlegmail://';
    return 'app';
  }
  const url = search
    ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(search)}`
    : 'https://mail.google.com/mail/u/0/';
  window.open(url, '_blank', 'noopener');
  return 'web';
}
