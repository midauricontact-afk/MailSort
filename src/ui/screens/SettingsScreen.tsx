import { useState } from 'react';
import { formatDate } from '../../core/format';
import { store, useAppState, type Theme } from '../../state/store';
import { openGmail } from '../openGmail';
import { useUI } from '../uiContext';
import { LinkTesterSheet } from './LinkTesterSheet';

/** Onglet « Réglages ». */
export function SettingsScreen() {
  const s = useAppState();
  const ui = useUI();
  const st = s.settings;
  const [testLinks, setTestLinks] = useState(false);

  const signOut = async () => {
    const choice = await ui.ask({
      title: s.demo ? 'Quitter la démo ?' : 'Se déconnecter ?',
      message: s.demo
        ? 'Les données de démonstration seront effacées.'
        : 'Le cache local est conservé. Les libellés et filtres restent dans ton compte Gmail.',
      actions: [
        { id: 'cancel', label: 'Annuler', style: 'cancel' },
        { id: 'ok', label: s.demo ? 'Quitter' : 'Déconnexion', style: 'destructive' },
      ],
    });
    if (choice === 'ok') await store.signOut();
  };

  return (
    <>
      <div className="group-title">Compte</div>
      <div className="card settings">
        <div className="setting">
          <span>Compte Gmail</span>
          <span className="muted ellipsis">{s.email}</span>
        </div>
        {s.demo && (
          <div className="setting">
            <span className="muted small">Mode démo : aucune action n’est envoyée à Gmail.</span>
          </div>
        )}
        <div className="setting">
          <span>Dernière synchro</span>
          <span className="muted">{s.lastSync ? formatDate(s.lastSync) : 'jamais'}</span>
        </div>
        <button className="setting link" onClick={() => void openGmail()}>
          Ouvrir l’app Gmail
        </button>
        <button className="setting link" onClick={() => setTestLinks(true)}>
          Tester les liens Gmail
        </button>
      </div>
      {testLinks && <LinkTesterSheet onClose={() => setTestLinks(false)} />}

      <div className="group-title">Tri</div>
      <div className="card settings">
        <label className="setting">
          <span>Mails analysés</span>
          <select value={st.syncLimit} onChange={(e) => store.updateSettings({ syncLimit: Number(e.target.value) })}>
            {[1000, 2000, 5000, 10000, 20000, 50000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString('fr-FR')} plus récents
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label="Ranger dans Gmail après chaque synchro"
          help="Ajoute les libellés MailSort/… sur ton compte."
          checked={st.autoApplyLabels}
          onChange={(v) => store.updateSettings({ autoApplyLabels: v })}
        />
        <Toggle
          label="Trier aussi les futurs mails"
          help="Crée des filtres Gmail par catégorie : les nouveaux mails reçoivent le bon libellé même quand MailSort est fermé."
          checked={st.autoFilters}
          onChange={(v) => store.updateSettings({ autoFilters: v })}
        />
        <button className="setting link" disabled={!!s.busy} onClick={() => void store.applyLabels()}>
          Appliquer les libellés maintenant
        </button>
      </div>

      <div className="group-title">Apparence</div>
      <div className="card settings">
        <div className="setting">
          <span>Thème</span>
          <div className="segmented small">
            {(
              [
                ['auto', 'Auto'],
                ['light', 'Clair'],
                ['dark', 'Sombre'],
              ] as [Theme, string][]
            ).map(([id, label]) => (
              <button key={id} className={st.theme === id ? 'active' : ''} onClick={() => store.updateSettings({ theme: id })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="group-title">Données</div>
      <div className="card settings">
        <button className="setting link" disabled={!!s.busy} onClick={() => void store.resetCache()}>
          Vider le cache et tout réanalyser
        </button>
        <button className="setting link danger" onClick={() => void signOut()}>
          {s.demo ? 'Quitter la démo' : 'Se déconnecter'}
        </button>
      </div>

      <p className="footnote">
        MailSort ne supprime jamais un mail définitivement : tout passe par la corbeille de Gmail (vidée par Gmail après 30
        jours). Tes données restent sur ce téléphone ; aucun serveur MailSort n’existe.
      </p>
    </>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="setting toggle-row">
      <span>
        {label}
        {help && <small className="muted block">{help}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
