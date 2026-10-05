import { useMemo, useState } from 'react';
import type { SenderStatus } from '../../core/types';
import { store, useAppState } from '../../state/store';
import { SenderRow } from '../components/SenderRow';
import { SearchBar, matchesSearch } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';

const TABS: { id: SenderStatus; label: string; help: string }[] = [
  { id: 'neutral', label: 'Neutres', help: 'Ni autorisés ni bloqués : ils sont simplement triés.' },
  { id: 'allowed', label: 'Autorisés', help: 'Un filtre Gmail les marque « Importants » et leur ajoute le libellé MailSort/Autorisés. Ils sont exclus des suggestions de nettoyage.' },
  { id: 'blocked', label: 'Bloqués', help: 'Un filtre Gmail envoie leurs nouveaux mails directement à la corbeille.' },
];

/** Onglet « Expéditeurs » : Autorisés / Bloqués / Neutres. */
export function SendersScreen() {
  const s = useAppState();
  const [tab, setTab] = useState<SenderStatus>('neutral');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'count' | 'name' | 'recent'>('count');

  const counts = useMemo(() => {
    const c: Record<SenderStatus, number> = { neutral: 0, allowed: 0, blocked: 0 };
    for (const g of s.groups) c[g.status]++;
    return c;
  }, [s.groups]);

  const list = useMemo(() => {
    const out = s.groups.filter((g) => g.status === tab && matchesSearch(g, query));
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    else if (sort === 'recent') out.sort((a, b) => b.newest - a.newest);
    else out.sort((a, b) => b.count - a.count);
    return out;
  }, [s.groups, tab, query, sort]);

  // Les expéditeurs bloqués n'ont souvent plus aucun mail en cache : on les liste à part.
  const blockedWithoutMail = useMemo(
    () =>
      tab === 'blocked'
        ? [...s.overrides.values()].filter((o) => o.status === 'blocked' && !s.groupsByKey.has(o.key))
        : [],
    [tab, s.overrides, s.groupsByKey],
  );

  return (
    <>
      <div className="segmented" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="seg-count">{t.id === 'blocked' ? counts.blocked + blockedWithoutMail.length : counts[t.id]}</span>
          </button>
        ))}
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Rechercher" />
      <div className="toolbar">
        <p className="muted small">{TABS.find((t) => t.id === tab)!.help}</p>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier">
          <option value="count">Plus de mails</option>
          <option value="recent">Plus récents</option>
          <option value="name">A → Z</option>
        </select>
      </div>

      {list.length || blockedWithoutMail.length ? (
        <div className="list">
          {list.map((g) => (
            <SenderRow key={g.key} group={g} showCategory />
          ))}
          {blockedWithoutMail.map((o) => (
            <div key={o.key} className="row static">
              <div className="row-main">
                <div className="row-title">{o.name ?? o.key.replace(/^(brand|person|name):/, '')}</div>
                <div className="row-sub">Bloqué · plus aucun mail dans ta boîte</div>
              </div>
              <button className="btn small ghost" disabled={!!s.busy} onClick={() => void store.setStatus(o.key, 'neutral')}>
                Débloquer
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          emoji={tab === 'blocked' ? '🚫' : tab === 'allowed' ? '⭐️' : '📭'}
          text={
            query
              ? 'Aucun expéditeur ne correspond.'
              : tab === 'neutral'
                ? 'Aucun expéditeur.'
                : `Aucun expéditeur ${tab === 'allowed' ? 'autorisé' : 'bloqué'}. Glisse une ligne pour en ajouter.`
          }
        />
      )}
    </>
  );
}
