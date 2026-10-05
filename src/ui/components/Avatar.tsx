import { useState } from 'react';
import type { SenderGroup } from '../../core/types';
import { CATEGORY_BY_ID } from '../../core/categories';

/** Logo du site (favicon) pour une entreprise, initiales pour une personne. */
export function Avatar({ group, size = 40 }: { group: SenderGroup; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = group.domains[0];
  const color = CATEGORY_BY_ID[group.category].color;
  const initials = group.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="avatar" style={{ width: size, height: size, background: `${color}22`, color }}>
      {domain && !group.isPerson && !failed ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          alt=""
          width={size * 0.55}
          height={size * 0.55}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.38 }}>{initials || '?'}</span>
      )}
    </div>
  );
}
