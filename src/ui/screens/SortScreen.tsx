import { useMemo, useState } from 'react';
import type { CategoryId } from '../../core/types';
import { CATEGORIES } from '../../core/categories';
import { formatBytes } from '../../core/format';
import { store, useAppState } from '../../state/store';
import { SenderRow } from '../components/SenderRow';
import { SearchBar, matchesSearch } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';

/** Onglet « Tri » : les catégories, et les expéditeurs rangés dedans. */
export function SortScreen() {
  const s = useAppState();
  const [selected, setSelected] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');

  const stats = useMemo(() => {
    const out = new Map<CategoryId, { senders: number; mails: number; size: number }>();
    for (const g of s.groups) {
      const st = out.get(g.category) ?? { senders: 0, mails: 0, size: 0 };
      st.senders++;
      st.mails += g.count;
      st.size += g.size;
      out.set(g.category, st);
    }
    return out;
  }, [s.groups]);

  const list = useMemo(
    () =>
      s.groups
        .filter((g) => (selected === 'all' || g.category === selected) && matchesSearch(g, query))
        .sort((a, b) => b.count - a.count),
    [s.groups, selected, query],
  );

  const applied = s.lastLabelApply;
  return (
    <>
      <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un expéditeur" />

      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const st = stats.get(c.id);
          const active = selected === c.id;
          return (
            <button
              key={c.id}
              className={`cat-card${active ? ' active' : ''}`}
              style={{ ['--cat' as string]: c.color }}
              onClick={() => setSelected(active ? 'all' : c.id)}
            >
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-label">{c.label}</span>
              <span className="cat-count">
                {st ? `${st.senders} exp. · ${st.mails.toLocaleString('fr-FR')} mails` : 'Vide'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="card info-card">
        <div>
          <strong>Libellés dans Gmail</strong>
          <p className="muted small">
            {applied
              ? 'Retrouve ce tri dans l’app Gmail : menu ☰ › Libellés › MailSort.'
              : 'Pas encore appliqués à ton compte Gmail.'}
          </p>
        </div>
        <button className="btn small" disabled={!!s.busy || !s.groups.length} onClick={() => void store.applyLabels()}>
          {applied ? 'Mettre à jour' : 'Appliquer'}
        </button>
      </div>

      <div className="section-title">
        <span>
          {selected === 'all' ? 'Tous les expéditeurs' : CATEGORIES.find((c) => c.id === selected)!.label}
          {' · '}
          {list.length}
        </span>
        {selected !== 'all' && <span className="muted small">{formatBytes(stats.get(selected)?.size ?? 0)}</span>}
      </div>
      <p className="hint">Glisse vers la gauche pour déplacer ou bloquer, vers la droite pour autoriser.</p>

      {list.length ? (
        <div className="list">
          {list.map((g) => (
            <SenderRow key={g.key} group={g} showCategory={selected === 'all'} />
          ))}
        </div>
      ) : (
        <EmptyState text={query ? 'Aucun expéditeur ne correspond.' : 'Rien ici pour l’instant.'} />
      )}
    </>
  );
}
