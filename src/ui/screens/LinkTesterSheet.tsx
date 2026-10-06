import { useMemo, useState } from 'react';
import type { MessageMeta } from '../../core/types';
import { identifySender } from '../../core/classifier';
import { senderSearchQuery } from '../../core/filters';
import { useAppState } from '../../state/store';
import { Sheet } from '../components/Sheet';
import {
  MAIL_LINK_FORMATS,
  SEARCH_LINK_FORMATS,
  getMailLinkFormat,
  getSearchLinkFormat,
  openGmail,
  openLink,
  setMailLinkFormat,
  setSearchLinkFormat,
} from '../openGmail';

/**
 * Essai des différents liens vers l'app Gmail sur l'iPhone de l'utilisateur.
 * Chaque format est essayé à la main ; celui qui marche est mémorisé.
 */
export function LinkTesterSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const [mailFormat, setMail] = useState(getMailLinkFormat());
  const [searchFormat, setSearch] = useState(getSearchLinkFormat());

  const latest = useMemo(() => {
    let best: MessageMeta | undefined;
    for (const m of s.messages.values()) if (!best || m.date > best.date) best = m;
    return best;
  }, [s.messages]);

  const query = useMemo(() => {
    if (!latest) return '';
    const key = identifySender(latest.fromEmail, latest.fromName, !!latest.listUnsubscribe).key;
    const g = s.groupsByKey.get(key);
    return g ? senderSearchQuery(g) : `from:${latest.fromEmail}`;
  }, [latest, s.groupsByKey]);

  if (!latest) {
    return (
      <Sheet title="Tester les liens Gmail" onClose={onClose}>
        <p className="muted">Synchronise d’abord ta boîte.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title="Tester les liens Gmail" onClose={onClose}>
      <p className="muted small">
        Touche <b>Essayer</b> sur chaque ligne. Si Gmail s’ouvre sur le bon mail, reviens ici et touche <b>Utiliser</b>.
      </p>

      <h4 className="sheet-section">Ouvrir un mail</h4>
      <p className="muted small">
        Mail de test : « {latest.subject || '(sans objet)'} » de {latest.fromName || latest.fromEmail}
      </p>
      <div className="list">
        {MAIL_LINK_FORMATS.map((f) => (
          <div key={f.id} className="link-test">
            <span className="ellipsis">{f.label}</span>
            <button className="btn small ghost" onClick={() => openLink(f.build(latest.threadId))}>
              Essayer
            </button>
            <button
              className={`btn small ${mailFormat === f.id ? 'primary' : 'ghost'}`}
              onClick={() => {
                setMailLinkFormat(f.id);
                setMail(f.id);
              }}
            >
              {mailFormat === f.id ? 'Utilisé' : 'Utiliser'}
            </button>
          </div>
        ))}
      </div>

      <h4 className="sheet-section">Ouvrir les mails d’un expéditeur</h4>
      <p className="muted small">Recherche de test : {query}</p>
      <div className="list">
        {SEARCH_LINK_FORMATS.map((f) => (
          <div key={f.id} className="link-test">
            <span className="ellipsis">{f.label}</span>
            <button className="btn small ghost" onClick={() => void openGmail(query, f.id)}>
              Essayer
            </button>
            <button
              className={`btn small ${searchFormat === f.id ? 'primary' : 'ghost'}`}
              onClick={() => {
                setSearchLinkFormat(f.id);
                setSearch(f.id);
              }}
            >
              {searchFormat === f.id ? 'Utilisé' : 'Utiliser'}
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
