const PLACEHOLDER_MARK = 'REMPLACER';
const CLIENT_ID_KEY = 'mailsort.clientId';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

function isValidClientId(id: string | null | undefined): id is string {
  return !!id && !id.includes(PLACEHOLDER_MARK) && id.endsWith('.apps.googleusercontent.com');
}

/**
 * Identifiant client OAuth : celui du fichier .env, ou à défaut celui collé
 * dans l'écran d'accueil de l'app (pratique si on ne veut pas reconstruire).
 */
export function getClientId(): string | null {
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (isValidClientId(fromEnv)) return fromEnv;
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (isValidClientId(stored)) return stored;
  } catch {
    /* stockage indisponible */
  }
  return null;
}

export function saveClientId(id: string): boolean {
  const trimmed = id.trim();
  if (!isValidClientId(trimmed)) return false;
  localStorage.setItem(CLIENT_ID_KEY, trimmed);
  return true;
}

export function clientIdFromEnv(): boolean {
  return isValidClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);
}
