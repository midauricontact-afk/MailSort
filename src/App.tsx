import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { store, useAppState } from './state/store';
import { formatDate } from './core/format';
import { UIContext, type DialogRequest, type TabId, type UI } from './ui/uiContext';
import { Dialog } from './ui/components/Dialog';
import { IconDisk, IconGear, IconRefresh, IconSort, IconSpark, IconUsers } from './ui/icons';
import { SortScreen } from './ui/screens/SortScreen';
import { SendersScreen } from './ui/screens/SendersScreen';
import { StorageScreen } from './ui/screens/StorageScreen';
import { TipsScreen } from './ui/screens/TipsScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { CategoryPickerSheet, SenderSheet } from './ui/screens/SenderSheet';
import { WelcomeScreen } from './ui/screens/WelcomeScreen';

const TABS: { id: TabId; label: string; title: string; icon: ReactNode }[] = [
  { id: 'sort', label: 'Tri', title: 'Tri', icon: <IconSort /> },
  { id: 'senders', label: 'Expéditeurs', title: 'Expéditeurs', icon: <IconUsers /> },
  { id: 'storage', label: 'Stockage', title: 'Stockage', icon: <IconDisk /> },
  { id: 'tips', label: 'Conseils', title: 'Conseils', icon: <IconSpark /> },
  { id: 'settings', label: 'Réglages', title: 'Réglages', icon: <IconGear /> },
];

export function App() {
  const s = useAppState();
  const [tab, setTab] = useState<TabId>('sort');
  const [senderKey, setSenderKey] = useState<string | null>(null);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogResolve = useRef<((id: string | null) => void) | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const ask = useCallback(
    (req: DialogRequest) =>
      new Promise<string | null>((resolve) => {
        dialogResolve.current?.(null);
        dialogResolve.current = resolve;
        setDialog(req);
      }),
    [],
  );

  const ui = useMemo<UI>(
    () => ({
      openSender: (key) => setSenderKey(key),
      ask,
      pickCategory: (key) => setPickKey(key),
      goTab: (t) => {
        setSenderKey(null);
        setTab(t);
      },
    }),
    [ask],
  );

  const closeSender = useCallback(() => setSenderKey(null), []);
  const closePicker = useCallback(() => setPickKey(null), []);

  if (s.phase === 'loading') {
    return <div className="splash" aria-busy="true" />;
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <UIContext.Provider value={ui}>
      {s.phase !== 'ready' ? (
        <WelcomeScreen />
      ) : (
        <div className="app">
          <header className="topbar">
            <div className="topbar-row">
              <div>
                <h1>{current.title}</h1>
                <p className="muted small">
                  {s.demo ? 'Démo · ' : ''}
                  {s.messages.size.toLocaleString('fr-FR')} mails · {s.groups.length} expéditeurs
                  {s.lastSync ? ` · synchro ${formatDate(s.lastSync)}` : ''}
                </p>
              </div>
              <button
                className={`icon-btn round${s.busy ? ' spinning' : ''}`}
                aria-label="Synchroniser"
                disabled={!!s.busy}
                onClick={() => void store.sync()}
              >
                <IconRefresh />
              </button>
            </div>
            {s.busy && (
              <div className="busy" role="status">
                <span className="small">
                  {s.busy.label}
                  {s.busy.total > 0 && ` ${Math.min(s.busy.done, s.busy.total).toLocaleString('fr-FR')} / ${s.busy.total.toLocaleString('fr-FR')}`}
                </span>
                <div className={`progress${s.busy.total ? '' : ' indeterminate'}`}>
                  <div style={{ width: s.busy.total ? `${(s.busy.done / s.busy.total) * 100}%` : undefined }} />
                </div>
              </div>
            )}
            {s.needsReconnect && !s.demo && (
              <button className="reconnect" onClick={() => void store.reconnect()}>
                Session Google expirée · <strong>Toucher pour reconnecter</strong>
              </button>
            )}
          </header>

          <main className="content" ref={mainRef}>
            {s.messages.size === 0 && !s.busy ? (
              <div className="empty">
                <div className="empty-emoji">📬</div>
                <p>Aucun mail analysé pour l’instant.</p>
                <button className="btn primary" onClick={() => void store.sync()}>
                  Analyser ma boîte
                </button>
              </div>
            ) : (
              <>
                {tab === 'sort' && <SortScreen />}
                {tab === 'senders' && <SendersScreen />}
                {tab === 'storage' && <StorageScreen />}
                {tab === 'tips' && <TipsScreen />}
                {tab === 'settings' && <SettingsScreen />}
              </>
            )}
          </main>

          <nav className="tabbar" aria-label="Navigation">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => {
                  if (tab === t.id) mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  window.scrollTo({ top: 0 });
                  setTab(t.id);
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {senderKey && <SenderSheet groupKey={senderKey} onClose={closeSender} />}
          {pickKey && <CategoryPickerSheet groupKey={pickKey} onClose={closePicker} />}
        </div>
      )}

      {dialog && (
        <Dialog
          req={dialog}
          onResult={(id) => {
            setDialog(null);
            const r = dialogResolve.current;
            dialogResolve.current = null;
            r?.(id);
          }}
        />
      )}

      <div className="toasts" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}
