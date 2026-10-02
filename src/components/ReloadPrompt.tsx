import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

// T75: takes no props and subscribes to no finance context - `React.memo`
// here means `MainApp` (its only parent) re-rendering for an unrelated
// UI-state change (e.g. a tab switch) no longer re-renders this component;
// it still re-renders on its own `useRegisterSW` state changes exactly as
// before.
export const ReloadPrompt: React.FC = React.memo(() => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every 60 minutes
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('PWA service worker registration failed:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    // Below `md` it sits above the bottom nav (ADR 0041): the nav is 65px plus
    // the safe-area inset, and the centre Quick Add's top is 66px up, so 5rem
    // over the nav's own inset expression leaves a 14px gap. From `md` the nav
    // is hidden and the toast keeps its corner. No entrance animation (ADR 0026).
    //
    // z-45 (ADR 0042): above the header and the bottom nav (z-40) and the page,
    // below every Modal (z-50). At z-50 it tied with the More sheet and every
    // view-level dialog and won on DOM order, covering their rows.
    <aside
      aria-label="App update notification"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0.5rem))] md:bottom-5 right-5 z-45 max-w-sm w-[calc(100vw-2.5rem)] bg-surface-1 text-fg rounded-lg p-4 shadow-modal border border-line"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-tint text-brand shrink-0">
          {needRefresh ? (
            <RefreshCw className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-income" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-fg">
            {needRefresh ? 'A new version is ready' : 'Ready to use offline'}
          </h4>
          <p className="text-[11px] text-fg-secondary mt-0.5 leading-relaxed">
            {needRefresh
              ? 'Reload to start using it.'
              : 'FinLife is saved on this device, so it opens without a connection.'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {needRefresh && (
              <Button id="pwa-reload-button" onClick={() => updateServiceWorker(true)}>
                Reload
              </Button>
            )}
            <Button id="pwa-dismiss-button" variant="secondary" onClick={close}>
              Dismiss
            </Button>
          </div>
        </div>

        <IconButton label="Close notification" onClick={close} className="-mt-3 -mr-3">
          <X className="w-4 h-4" />
        </IconButton>
      </div>
    </aside>
  );
});

ReloadPrompt.displayName = 'ReloadPrompt';
