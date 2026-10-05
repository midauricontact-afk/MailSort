import { useMemo } from 'react';
import { buildSuggestions, type Suggestion } from '../../core/suggestions';
import { formatBytes } from '../../core/format';
import { store, useAppState } from '../../state/store';
import { EmptyState } from '../components/EmptyState';
import { useUI } from '../uiContext';

const EMOJI: Record<Suggestion['kind'], string> = {
  unsubscribe: '📭',
  cleanOld: '🕰️',
  blockedLeftovers: '🚫',
  socialNotifs: '🔔',
  bigFiles: '📎',
};

/** Onglet « Conseils » : suggestions intelligentes calculées sur le téléphone. */
export function TipsScreen() {
  const s = useAppState();
  const ui = useUI();
  const suggestions = useMemo(() => buildSuggestions(s.groups, s.messages, s.dismissed), [s.groups, s.messages, s.dismissed]);
  const totalSize = suggestions.reduce((sum, x) => sum + x.size, 0);

  const act = async (sug: Suggestion) => {
    if (sug.kind === 'bigFiles') {
      ui.goTab('storage');
      return;
    }
    const g = sug.groupKey ? s.groupsByKey.get(sug.groupKey) : undefined;
    if (sug.canUnsubscribe && g) {
      // Désinscription d'abord, au toucher (Safari bloque les pages ouvertes plus tard).
      await store.unsubscribe(g.key);
    }
    const choice = await ui.ask({
      title: sug.canUnsubscribe ? 'Et les mails déjà reçus ?' : sug.title,
      message: `${sug.messageIds.length.toLocaleString('fr-FR')} mails (${formatBytes(sug.size)}) iront dans la corbeille de Gmail, récupérables pendant 30 jours.`,
      actions: [
        { id: 'cancel', label: sug.canUnsubscribe ? 'Les garder' : 'Annuler', style: 'cancel' },
        { id: 'ok', label: 'Mettre à la corbeille', style: 'destructive' },
      ],
    });
    if (choice === 'ok') await store.trash(sug.messageIds);
  };

  if (!suggestions.length) {
    return <EmptyState emoji="🎉" text="Aucune suggestion : ta boîte est bien rangée !" />;
  }

  return (
    <>
      <div className="card tips-header">
        <div className="big-number">{formatBytes(totalSize)}</div>
        <p className="muted small">à libérer en suivant ces {suggestions.length} suggestions.</p>
      </div>
      <div className="tips">
        {suggestions.map((sug) => (
          <article key={sug.id} className="card tip">
            <div className="tip-head">
              <span className="tip-emoji">{EMOJI[sug.kind]}</span>
              <div>
                <h3>{sug.title}</h3>
                <p className="muted small">{sug.detail}</p>
              </div>
            </div>
            <div className="tip-actions">
              <span className="muted small">{formatBytes(sug.size)}</span>
              <div className="spacer" />
              {sug.groupKey && (
                <button className="btn small ghost" onClick={() => ui.openSender(sug.groupKey!)}>
                  Détails
                </button>
              )}
              <button className="btn small ghost" onClick={() => void store.dismissSuggestion(sug.id)}>
                Ignorer
              </button>
              <button className="btn small primary" disabled={!!s.busy} onClick={() => void act(sug)}>
                {sug.kind === 'bigFiles' ? 'Voir' : sug.canUnsubscribe ? 'Se désinscrire' : 'Nettoyer'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
