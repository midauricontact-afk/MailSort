import type { ReactNode } from 'react';
import type { SenderGroup } from '../../core/types';
import { CATEGORY_BY_ID } from '../../core/categories';
import { formatBytes, formatDate } from '../../core/format';
import { allowSender, blockSender, neutralSender } from '../actions';
import { IconBlock, IconCheck, IconChevron, IconFolder } from '../icons';
import { useUI } from '../uiContext';
import { Avatar } from './Avatar';
import { SwipeRow, type SwipeAction } from './SwipeRow';

/**
 * Une ligne expéditeur.
 * Glisser → : Autoriser. Glisser ← : Déplacer (catégorie) / Bloquer.
 */
export function SenderRow({
  group,
  detail,
  showCategory = false,
  extra,
}: {
  group: SenderGroup;
  detail?: string;
  showCategory?: boolean;
  extra?: ReactNode;
}) {
  const ui = useUI();
  const cat = CATEGORY_BY_ID[group.category];

  const left: SwipeAction[] =
    group.status === 'allowed'
      ? [{ label: 'Neutre', color: 'var(--gray)', icon: <IconCheck />, onAction: () => void neutralSender(group) }]
      : [{ label: 'Autoriser', color: 'var(--green)', icon: <IconCheck />, onAction: () => void allowSender(group) }];

  const right: SwipeAction[] = [
    { label: 'Déplacer', color: 'var(--blue)', icon: <IconFolder />, onAction: () => ui.pickCategory(group.key) },
    group.status === 'blocked'
      ? { label: 'Débloquer', color: 'var(--gray)', icon: <IconBlock />, onAction: () => void neutralSender(group) }
      : { label: 'Bloquer', color: 'var(--red)', icon: <IconBlock />, onAction: () => void blockSender(ui, group) },
  ];

  return (
    <SwipeRow left={left} right={right} onTap={() => ui.openSender(group.key)}>
      <div className="row">
        <Avatar group={group} />
        <div className="row-main">
          <div className="row-title">
            <span className="ellipsis">{group.name}</span>
            {group.status === 'allowed' && <span className="badge green">Autorisé</span>}
            {group.status === 'blocked' && <span className="badge red">Bloqué</span>}
          </div>
          <div className="row-sub ellipsis">
            {detail ??
              `${group.count.toLocaleString('fr-FR')} mail${group.count > 1 ? 's' : ''} · ${formatBytes(group.size)}` +
                (group.unreadCount ? ` · ${group.unreadCount} non lu${group.unreadCount > 1 ? 's' : ''}` : '')}
          </div>
          {showCategory && (
            <div className="row-cat" style={{ color: cat.color }}>
              {cat.emoji} {cat.label}
            </div>
          )}
          {extra}
        </div>
        <div className="row-end">
          <span className="row-date">{formatDate(group.newest)}</span>
          <IconChevron width={16} height={16} className="muted" />
        </div>
      </div>
    </SwipeRow>
  );
}
