import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string;
  onAction: () => void;
}

const ACTION_W = 78;
const OPEN_EVENT = 'mailsort-swipe-open';

/**
 * Ligne glissable façon iOS.
 * - Glisser vers la droite révèle `left`, vers la gauche révèle `right`.
 * - Un glissement long (plus de la moitié de la ligne) déclenche directement la première action.
 */
export function SwipeRow({
  left = [],
  right = [],
  onTap,
  children,
}: {
  left?: SwipeAction[];
  right?: SwipeAction[];
  onTap?: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; lock: 'h' | 'v' | null; pointer: number } | null>(null);
  const leftW = left.length * ACTION_W;
  const rightW = right.length * ACTION_W;

  useEffect(() => {
    const close = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setX(0);
    };
    window.addEventListener(OPEN_EVENT, close);
    return () => window.removeEventListener(OPEN_EVENT, close);
  }, [id]);

  const announceOpen = () => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, base: x, lock: null, pointer: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.lock = 'h';
        setDragging(true);
        announceOpen();
        rowRef.current?.setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > 8) {
        d.lock = 'v';
      }
    }
    if (d.lock !== 'h') return;
    const width = rowRef.current?.offsetWidth ?? 360;
    let nx = d.base + dx;
    if (nx > 0 && !leftW) nx = nx * 0.15;
    if (nx < 0 && !rightW) nx = nx * 0.15;
    setX(Math.max(-width, Math.min(width, nx)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.lock === 'h') {
      const width = rowRef.current?.offsetWidth ?? 360;
      if (left.length && x > width * 0.55) {
        setX(0);
        left[0].onAction();
      } else if (right.length && x < -width * 0.55) {
        setX(0);
        right[0].onAction();
      } else if (leftW && x > leftW / 2) setX(leftW);
      else if (rightW && x < -rightW / 2) setX(-rightW);
      else setX(0);
      return;
    }
    if (d.lock === null && e.type === 'pointerup') {
      if (x !== 0) setX(0);
      else onTap?.();
    }
  };

  const run = (a: SwipeAction) => {
    setX(0);
    a.onAction();
  };

  return (
    <div className="swipe" ref={rowRef}>
      {left.length > 0 && x > 0 && (
        <div className="swipe-actions swipe-actions-left" style={{ width: Math.max(x, leftW) }}>
          {left.map((a) => (
            <button key={a.label} className="swipe-btn" style={{ background: a.color, flex: 1 }} onClick={() => run(a)}>
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
      {right.length > 0 && x < 0 && (
        <div className="swipe-actions swipe-actions-right" style={{ width: Math.max(-x, rightW) }}>
          {right.map((a) => (
            <button key={a.label} className="swipe-btn" style={{ background: a.color, flex: 1 }} onClick={() => run(a)}>
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={`swipe-content${dragging ? ' dragging' : ''}`}
        style={{ transform: `translate3d(${x}px,0,0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onTap?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}
