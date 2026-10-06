import { useMemo, useState } from 'react';
import type { SenderStatus } from '../../core/types';
import { CATEGORIES } from '../../core/categories';
import { senderSearchQuery } from '../../core/filters';
import { formatBytes, formatDate } from '../../core/format';
import { parseListUnsubscribe } from '../../core/unsubscribe';
import { store, useAppState } from '../../state/store';
import { allowSender, blockSender, estimate, neutralSender, trashSender, unsubscribeSender } from '../actions';
import { Avatar } from '../components/Avatar';
import { Sheet } from '../components/Sheet';
import { IconMail, IconTrash, IconUnsub } from '../icons';
import { openGmail, openMailInGmail } from '../openGmail';
import { useUI } from '../uiContext';

/** Fiche d'un expéditeur : catégorie, statut, désinscription, nettoyage, derniers mails. */
export function SenderSheet({ groupKey, onClose }: { groupKey: string; onClose: () => void }) {
  const s = useAppState();
  const ui = useUI();
  const g = s.groupsByKey.get(groupKey);
  const [months, setMonths] = useState(6);

  const recent = useMemo(
    () =>
      (g?.messageIds ?? [])
        .slice(0, 25)
        .map((id) => s.messages.get(id))
        .filter((m) => !!m),
    [g, s.messages],
  );

  if (!g) {
    return (
      <Sheet title="Expéditeur" onClose={onClose}>
        <p className="muted">Cet expéditeur n’a plus de mail dans ta boîte.</p>
      </Sheet>
    );
  }

  const old = estimate(g, months);
  const unsub = parseListUnsubscribe(g.listUnsubscribe, g.listUnsubscribePost);
  const readPct = g.count ? Math.round((1 - g.unreadCount / g.count) * 100) : 0;
  const busy = !!s.busy;

  const setStatus = (st: SenderStatus) => {
    if (st === g.status) return;
    if (st === 'blocked') void blockSender(ui, g);
    else if (st === 'allowed') void allowSender(g);
    else void neutralSender(g);
  };

  const gmail = async () => {
    const copied = await openGmail(senderSearchQuery(g));
    if (copied) store.toast('Recherche copiée : colle-la dans la barre de recherche de Gmail', 'info');
  };

  return (
    <Sheet title={g.name} onClose={onClose}>
      <div className="sender-head">
        <Avatar group={g} size={56} />
        <div className="sender-meta">
          <div className="muted small ellipsis">{(g.domains.length ? g.domains : g.emails).join(', ')}</div>
          <div className="stats">
            <div>
              <strong>{g.count.toLocaleString('fr-FR')}</strong>
              <span>mails</span>
            </div>
            <div>
              <strong>{formatBytes(g.size)}</strong>
              <span>espace</span>
            </div>
            <div>
              <strong>{readPct} %</strong>
              <span>lus</span>
            </div>
          </div>
        </div>
      </div>

      <h4 className="sheet-section">Statut</h4>
      <div className="segmented">
        {(
          [
            ['neutral', 'Neutre'],
            ['allowed', 'Autorisé'],
            ['blocked', 'Bloqué'],
          ] as [SenderStatus, string][]
        ).map(([id, label]) => (
          <button key={id} disabled={busy} className={g.status === id ? `active ${id}` : ''} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>

      <h4 className="sheet-section">
        Catégorie {g.category !== g.autoCategory && <span className="muted small">(choisie par toi)</span>}
      </h4>
      <div className="cat-picker">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip${g.category === c.id ? ' active' : ''}`}
            style={{ ['--cat' as string]: c.color }}
            disabled={busy}
            onClick={() => void store.moveToCategory(g.key, c.id)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <h4 className="sheet-section">Actions</h4>
      <div className="action-list">
        {unsub && (
          <button className="action" disabled={busy} onClick={() => void unsubscribeSender(ui, g)}>
            <IconUnsub />
            <span>
              Se désinscrire
              {g.unsubscribedAt && <small className="muted"> · demandé le {formatDate(g.unsubscribedAt)}</small>}
            </span>
          </button>
        )}
        <div className="action combo">
          <IconTrash />
          <span>
            Mails de plus de{' '}
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Ancienneté">
              {[1, 3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>
                  {m} mois
                </option>
              ))}
            </select>
            <small className="muted">
              {' '}
              · {old.count} mails · {formatBytes(old.size)}
            </small>
          </span>
          <button className="btn small danger" disabled={busy || !old.count} onClick={() => void trashSender(ui, g, months)}>
            Corbeille
          </button>
        </div>
        <button className="action danger" disabled={busy} onClick={() => void trashSender(ui, g)}>
          <IconTrash />
          <span>
            Tous les mails à la corbeille <small className="muted">· {formatBytes(g.size)}</small>
          </span>
        </button>
        <button className="action" onClick={() => void gmail()}>
          <IconMail />
          <span>Ouvrir dans Gmail</span>
        </button>
      </div>

      <h4 className="sheet-section">Derniers mails <span className="muted small">· touche pour ouvrir dans Gmail</span></h4>
      <div className="list compact">
        {recent.map((m) => (
          <button key={m.id} className="mail-row" onClick={() => openMailInGmail(m.threadId)}>
            <div className="ellipsis">
              {m.labelIds.includes('UNREAD') && <span className="dot" aria-label="non lu" />}
              {m.subject || '(sans objet)'}
            </div>
            <span className="muted small nowrap">
              {formatDate(m.date)} · {formatBytes(m.size)}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Choix rapide de catégorie (après un glissement « Déplacer »). */
export function CategoryPickerSheet({ groupKey, onClose }: { groupKey: string; onClose: () => void }) {
  const s = useAppState();
  const g = s.groupsByKey.get(groupKey);
  if (!g) return null;
  return (
    <Sheet title={`Déplacer ${g.name}`} onClose={onClose}>
      <div className="picker-list">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`picker-item${g.category === c.id ? ' active' : ''}`}
            onClick={() => {
              onClose();
              void store.moveToCategory(g.key, c.id);
            }}
          >
            <span className="cat-emoji">{c.emoji}</span>
            <span>{c.label}</span>
            {g.category === c.id && <span className="muted small">actuelle</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
