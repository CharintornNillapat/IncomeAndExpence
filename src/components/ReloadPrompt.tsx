import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

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
    <aside
      aria-label="App update notification"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-surface-1 text-fg rounded-lg p-4 shadow-modal border border-line animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-tint text-brand shrink-0">
          {needRefresh ? (
            <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-income" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-fg">
            {needRefresh ? 'New Update Available' : 'App Ready for Offline Use'}
          </h4>
          <p className="text-[11px] text-fg-secondary mt-0.5 leading-relaxed">
            {needRefresh
              ? 'A newer version of FinLife is available. Reload to update.'
              : 'All assets and cached data are saved for fast offline access.'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {needRefresh && (
              <button
                type="button"
                id="pwa-reload-button"
                onClick={() => updateServiceWorker(true)}
                className="px-3 py-1.5 bg-brand-fill hover:bg-brand-fill-hover text-white font-bold text-xs rounded-lg transition-colors duration-150 cursor-pointer"
              >
                Update Now
              </button>
            )}
            <button
              type="button"
              id="pwa-dismiss-button"
              onClick={close}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary font-semibold text-xs rounded-lg transition-colors duration-150 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          className="text-fg-muted hover:text-fg p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
});

ReloadPrompt.displayName = 'ReloadPrompt';
