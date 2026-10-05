import { useMemo, useState } from 'react';
import type { SenderGroup } from '../../core/types';
import { formatBytes, monthsAgo } from '../../core/format';
import { store, useAppState } from '../../state/store';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { IconTrash } from '../icons';
import { useUI } from '../uiContext';

type Filter = 'all' | 'big' | 'old' | 'promos';

interface Row {
  group: SenderGroup;
  ids: string[];
  count: number;
  size: number;
}

/** Onglet « Stockage » : qui prend de la place, et nettoyage en masse (vers la corbeille). */
export function StorageScreen() {
  const s = useAppState();
  const ui = useUI();
  const [sort, setSort] = useState<'size' | 'count'>('size');
  const [filter, setFilter] = useState<Filter>('all');
  const [months, setMonths] = useState(6);
  const [bigMB, setBigMB] = useState(5);

  const total = useMemo(() => {
    let size = 0;
    for (const m of s.messages.values()) size += m.size;
    return { size, count: s.messages.size };
  }, [s.messages]);

  const rows = useMemo<Row[]>(() => {
    const oldLimit = monthsAgo(months);
    const bigLimit = bigMB * 1024 * 1024;
    const out: Row[] = [];
    for (const g of s.groups) {
      if (filter === 'promos' && g.category !== 'newsletters') continue;
      const ids: string[] = [];
      let size = 0;
      for (const id of g.messageIds) {
        const m = s.messages.get(id);
        if (!m) continue;
        if (filter === 'big' && m.size < bigLimit) continue;
        if (filter === 'old' && m.date >= oldLimit) continue;
        if (filter === 'promos' && !m.labelIds.includes('UNREAD')) continue;
        ids.push(id);
        size += m.size;
      }
      if (ids.length) out.push({ group: g, ids, count: ids.length, size });
    }
    out.sort((a, b) => (sort === 'size' ? b.size - a.size : b.count - a.count));
    return out;
  }, [s.groups, s.messages, filter, months, bigMB, sort]);

  const max = rows.reduce((m, r) => Math.max(m, sort === 'size' ? r.size : r.count), 1);
  // Le nettoyage en masse épargne les expéditeurs autorisés et les mails personnels (à trier un par un).
  const cleanable = rows.filter((r) => r.group.status !== 'allowed' && r.group.category !== 'personal');
  const bulk = cleanable.reduce((a, r) => ({ count: a.count + r.count, size: a.size + r.size }), { count: 0, size: 0 });

  const filterLabel =
    filter === 'big'
      ? `mails de plus de ${bigMB} Mo`
      : filter === 'old'
        ? `mails de plus de ${months} mois`
        : filter === 'promos'
          ? 'promos jamais ouvertes'
          : 'mails';

  const trashRow = async (r: Row) => {
    const choice = await ui.ask({
      title: `Corbeille : ${r.group.name}`,
      message: `${r.count.toLocaleString('fr-FR')} ${filterLabel} (${formatBytes(r.size)}) iront dans la corbeille de Gmail, récupérables pendant 30 jours.`,
      actions: [
        { id: 'cancel', label: 'Annuler', style: 'cancel' },
        { id: 'ok', label: 'Mettre à la corbeille', style: 'destructive' },
      ],
    });
    if (choice === 'ok') await store.trash(r.ids);
  };

  const trashAll = async () => {
    const choice = await ui.ask({
      title: 'Nettoyage en masse',
      message:
        `${bulk.count.toLocaleString('fr-FR')} ${filterLabel} de ${cleanable.length} expéditeurs` +
        ` iront dans la corbeille : environ ${formatBytes(bulk.size)} libérés.` +
        `\n\nLes expéditeurs autorisés et les mails personnels ne sont pas touchés. Tout reste récupérable 30 jours dans la corbeille.`,
      actions: [
        { id: 'cancel', label: 'Annuler', style: 'cancel' },
        { id: 'ok', label: 'Tout mettre à la corbeille', style: 'destructive' },
      ],
    });
    if (choice === 'ok') await store.trash(cleanable.flatMap((r) => r.ids));
  };

  return (
    <>
      <div className="card storage-summary">
        <div className="big-number">{formatBytes(total.size)}</div>
        <p className="muted small">
          occupés par les {total.count.toLocaleString('fr-FR')} mails analysés ({s.groups.length} expéditeurs).
          Gmail vide la corbeille au bout de 30 jours : c’est là que l’espace est vraiment libéré.
        </p>
      </div>

      <div className="chips" role="radiogroup" aria-label="Filtre">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Tout</Chip>
        <Chip active={filter === 'big'} onClick={() => setFilter('big')}>📎 Grosses pièces jointes</Chip>
        <Chip active={filter === 'old'} onClick={() => setFilter('old')}>🕰️ Vieux mails</Chip>
        <Chip active={filter === 'promos'} onClick={() => setFilter('promos')}>📣 Promos jamais ouvertes</Chip>
      </div>

      <div className="toolbar">
        {filter === 'old' && (
          <label className="inline-select">
            Plus de
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {[1, 3, 6, 12, 24, 36].map((m) => (
                <option key={m} value={m}>
                  {m} mois
                </option>
              ))}
            </select>
          </label>
        )}
        {filter === 'big' && (
          <label className="inline-select">
            Plus de
            <select value={bigMB} onChange={(e) => setBigMB(Number(e.target.value))}>
              {[1, 2, 5, 10, 20].map((m) => (
                <option key={m} value={m}>
                  {m} Mo
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="segmented small">
          <button className={sort === 'size' ? 'active' : ''} onClick={() => setSort('size')}>
            Espace
          </button>
          <button className={sort === 'count' ? 'active' : ''} onClick={() => setSort('count')}>
            Nombre
          </button>
        </div>
      </div>

      {filter !== 'all' && bulk.count > 0 && (
        <button className="btn danger block" disabled={!!s.busy} onClick={() => void trashAll()}>
          <IconTrash width={18} height={18} /> Tout mettre à la corbeille · {bulk.count.toLocaleString('fr-FR')} mails ·{' '}
          {formatBytes(bulk.size)}
        </button>
      )}

      {rows.length ? (
        <div className="list">
          {rows.map((r) => {
            const value = sort === 'size' ? r.size : r.count;
            return (
              <div key={r.group.key} className="row storage-row">
                <button className="row-tap" onClick={() => ui.openSender(r.group.key)}>
                  <Avatar group={r.group} size={36} />
                  <div className="row-main">
                    <div className="row-title">
                      <span className="ellipsis">{r.group.name}</span>
                      {r.group.status === 'allowed' && <span className="badge green">Autorisé</span>}
                    </div>
                    <div className="row-sub">
                      {formatBytes(r.size)} · {r.count.toLocaleString('fr-FR')} mail{r.count > 1 ? 's' : ''}
                    </div>
                    <div className="bar">
                      <div style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
                    </div>
                  </div>
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={`Mettre à la corbeille les mails de ${r.group.name}`}
                  disabled={!!s.busy}
                  onClick={() => void trashRow(r)}
                >
                  <IconTrash width={20} height={20} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState emoji="✨" text="Rien à nettoyer avec ce filtre." />
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`chip${active ? ' active' : ''}`} role="radio" aria-checked={active} onClick={onClick}>
      {children}
    </button>
  );
}
