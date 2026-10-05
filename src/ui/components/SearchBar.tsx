import type { SenderGroup } from '../../core/types';
import { normalizeText } from '../../core/domain';
import { IconClose, IconSearch } from '../icons';

export function matchesSearch(g: SenderGroup, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return normalizeText([g.name, ...g.domains, ...g.emails].join(' ')).includes(q);
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <IconSearch width={18} height={18} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value && (
        <button className="icon-btn" onClick={() => onChange('')} aria-label="Effacer">
          <IconClose width={16} height={16} />
        </button>
      )}
    </label>
  );
}
