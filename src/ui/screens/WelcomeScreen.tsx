import { useState } from 'react';
import { store, useAppState } from '../../state/store';
import { isIOS } from '../openGmail';

/** Écran d'accueil : connexion Google, saisie de l'ID client si besoin, mode démo. */
export function WelcomeScreen() {
  const s = useAppState();
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  return (
    <div className="welcome">
      <img src="icons/icon-192.png" alt="" width={96} height={96} className="welcome-logo" />
      <h1>MailSort</h1>
      <p className="muted">
        Trie ta boîte Gmail par expéditeur, libère de la place et bloque les indésirables. Tout est appliqué directement sur
        ton compte : tu retrouves le même tri dans l’app Gmail.
      </p>

      {s.phase === 'needsClientId' ? (
        <div className="card welcome-card">
          <h3>Configuration</h3>
          <p className="muted small">
            L’identifiant client Google n’est pas encore configuré (fichier <code>.env</code>). Tu peux le coller ici : il se
            termine par <code>.apps.googleusercontent.com</code>.
          </p>
          <input
            className="text-input"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setError('');
            }}
            placeholder="123456-abc.apps.googleusercontent.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {error && <p className="error small">{error}</p>}
          <button
            className="btn primary block"
            onClick={() => {
              if (!store.setClientId(clientId)) setError('Identifiant invalide : il doit finir par .apps.googleusercontent.com');
            }}
          >
            Enregistrer
          </button>
        </div>
      ) : (
        <div className="welcome-actions">
          <button className="btn google block" onClick={() => void store.signIn()}>
            <GoogleG /> Se connecter avec Google
          </button>
          <button className="btn link small" onClick={() => store.signInWithRedirect()}>
            La fenêtre Google ne s’ouvre pas ? Connexion par redirection
          </button>
        </div>
      )}

      <button className="btn ghost block" onClick={() => void store.startDemo()}>
        Essayer avec des données de démo
      </button>

      {isIOS() && !standalone && (
        <div className="card install-hint">
          <strong>Installer l’app</strong>
          <p className="muted small">
            Dans Safari, touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b> : MailSort s’ouvrira en plein écran comme
            une vraie app.
          </p>
        </div>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
