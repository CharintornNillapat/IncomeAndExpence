import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
} from 'lucide-react';
import { Modal } from '../Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { useTransientFlash } from '../../hooks/useTransientFlash';
import { supabase } from '../../lib/supabase';
import { LABEL_CLASS, inputClass, PRIMARY_BUTTON_COMPACT_CLASS } from '../../utils/formStyles';
import { describeUserAgent } from '../../utils/userAgent';
import { formatLocalDateTime } from '../../utils/date';
import type { AuthSession } from '../../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Closes this modal and opens the sign-in modal (guest mode). */
  onRequestSignIn: () => void;
}

/**
 * Account & Security (ADR 0024) - what used to be the Security tab, moved out
 * of the tab bar into a shell-level modal. Mounted by `App.tsx` behind
 * `React.lazy` and a `hasOpened` latch (ADR 0010), like `QuickAddModal`.
 *
 * The body subscribes to finance state itself and only while the modal is open
 * (`Modal` unmounts its body when closed), so the shell never subscribes.
 */
export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onRequestSignIn }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Account & Security"
    subtitle="Your sign-in, your devices, and where your data lives"
    panelId="account-modal"
    titleId="account-modal-title"
    closeButtonId="account-modal-close-btn"
    maxWidthClassName="sm:max-w-2xl"
    bodyClassName="space-y-5"
  >
    <AccountModalBody onClose={onClose} onRequestSignIn={onRequestSignIn} />
  </Modal>
);

const AccountModalBody: React.FC<Omit<AccountModalProps, 'isOpen'>> = ({ onClose, onRequestSignIn }) => {
  const { currentUser, isAuthenticated, isSyncing } = useFinanceState();
  const { refreshFromCloud, signOut } = useFinanceActions();

  const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { value: syncFeedback, flash: flashSyncFeedback } = useTransientFlash<string | null>(null, 3500);

  const handleManualSync = async () => {
    await refreshFromCloud();
    flashSyncFeedback('Synchronized with the cloud.');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsConfirmingSignOut(false);
      onClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {/* Where the data lives */}
      <div
        id="account-status-card"
        className="p-4 rounded-xl bg-surface-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              isAuthenticated
                ? 'bg-income-tint text-income border-income-line'
                : 'bg-pending-tint text-pending border-pending-line'
            }`}
          >
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-fg">
              {isAuthenticated ? 'Cloud sync on' : 'Guest mode - this device only'}
            </p>
            <p className="text-xs text-fg-secondary truncate">
              {isAuthenticated
                ? currentUser.email
                : 'Your data is stored in this browser. Sign in to sync it across devices.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAuthenticated ? (
            <>
              <button
                id="account-sync-btn"
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-fg-secondary bg-surface-1 hover:bg-surface-3 border border-line hover:border-brand rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
              </button>
              <button
                id="navbar-signout-btn"
                type="button"
                onClick={() => setIsConfirmingSignOut(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-expense text-expense bg-transparent hover:bg-expense-tint rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <button
              id="account-signin-btn"
              type="button"
              onClick={() => {
                onClose();
                onRequestSignIn();
              }}
              className={`${PRIMARY_BUTTON_COMPACT_CLASS} inline-flex items-center gap-1.5`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 bg-income-tint border border-income-line text-income rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {isAuthenticated && (
        <>
          <SessionsSection />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ProfileSection />
            <PasswordSection />
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={isConfirmingSignOut}
        title="Sign out of this device?"
        description="This removes your account's data from this browser, including templates saved on this device - they are not synced and cannot be recovered. Your cloud data is untouched."
        confirmText="Sign out"
        isDestructive
        isLoading={isSigningOut}
        onConfirm={handleSignOut}
        onClose={() => setIsConfirmingSignOut(false)}
      />
    </>
  );
};

/**
 * The signed-in user's real sessions (`list_my_sessions`), with the two
 * revocations Supabase supports. No per-device revoke - see ADR 0024.
 */
const SessionsSection: React.FC = () => {
  const { listMySessions, signOutOtherDevices, signOut } = useFinanceActions();
  const [sessions, setSessions] = useState<AuthSession[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [confirming, setConfirming] = useState<'others' | 'everywhere' | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const { value: feedback, flash: flashFeedback } = useTransientFlash<string | null>(null, 3500);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listMySessions();
    setSessions(result.sessions);
    setLoadError(result.error ?? null);
    setIsLoading(false);
  }, [listMySessions]);

  useEffect(() => {
    load();
  }, [load]);

  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  const handleConfirm = async () => {
    setIsRevoking(true);
    setRevokeError(null);
    try {
      if (confirming === 'everywhere') {
        await signOut({ everywhere: true });
        return;
      }
      const result = await signOutOtherDevices();
      if (!result.success) {
        setRevokeError(result.error ?? 'Could not sign out your other devices');
        return;
      }
      setConfirming(null);
      flashFeedback('Your other devices have been signed out.');
      await load();
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <section id="account-sessions" className="rounded-xl border border-line p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-fg-secondary" />
          <h3 className="text-sm font-bold text-fg">Signed-in devices</h3>
        </div>
        {sessions && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-fg-secondary font-mono">
            {sessions.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-fg-secondary">Loading your sessions…</p>
      ) : sessions === null ? (
        <p id="account-sessions-unavailable" className="text-xs text-fg-secondary">
          The session list is unavailable right now{loadError ? ` (${loadError})` : ''}. Signing out other devices still
          works.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const device = describeUserAgent(s.userAgent);
            const Icon = device.isMobile ? Smartphone : Laptop;
            return (
              <li
                key={s.id}
                id={`session-item-${s.id}`}
                className={`p-3 rounded-lg border flex items-start gap-3 ${
                  s.isCurrent
                    ? 'border-brand-line bg-brand-tint'
                    : 'border-line'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 text-fg-secondary shrink-0" />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-fg flex flex-wrap items-center gap-2">
                    <span>{device.label}</span>
                    {s.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-tint text-brand">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-fg-secondary font-mono mt-0.5">
                    {s.ip ?? 'IP unknown'} · last active {formatLocalDateTime(s.lastActive) ?? 'unknown'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {feedback && (
        <p className="text-xs font-semibold text-income flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {feedback}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          id="account-signout-others-btn"
          type="button"
          onClick={() => setConfirming('others')}
          disabled={sessions !== null && otherSessions.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-expense text-expense bg-transparent hover:bg-expense-tint rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sign out other devices</span>
        </button>
        <button
          id="account-signout-everywhere-btn"
          type="button"
          onClick={() => setConfirming('everywhere')}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-fg-secondary bg-surface-2 hover:bg-surface-3 border border-line hover:border-brand rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out everywhere</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirming !== null}
        title={confirming === 'everywhere' ? 'Sign out everywhere?' : 'Sign out your other devices?'}
        description={
          confirming === 'everywhere'
            ? 'Every device, including this one, will be signed out, and this browser will be cleared of your account\'s data and templates.'
            : 'Every other device will be signed out and cleared within a minute while the app is on its screen, or as soon as it is next opened. This device stays signed in.'
        }
        confirmText={confirming === 'everywhere' ? 'Sign out everywhere' : 'Sign out others'}
        isDestructive
        isLoading={isRevoking}
        error={revokeError}
        onConfirm={handleConfirm}
        onClose={() => {
          setConfirming(null);
          setRevokeError(null);
        }}
      />
    </section>
  );
};

const ProfileSection: React.FC = () => {
  const { currentUser } = useFinanceState();
  const [nameInput, setNameInput] = useState<string>(currentUser.name || '');
  const { value: success, flash: flashSuccess, clear: clearSuccess } = useTransientFlash<string | null>(null, 3500);
  const { isSubmitting, error, handleSubmit } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update profile name',
    onSuccess: () => flashSuccess('Display name updated.'),
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    clearSuccess();
    return handleSubmit(e, async () => {
      const { error: updateError } = await supabase.auth.updateUser({ data: { name: nameInput.trim() } });
      if (updateError) throw updateError;
    });
  };

  return (
    <section className="rounded-xl border border-line p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-fg-secondary" />
        <h3 className="text-sm font-bold text-fg">Profile</h3>
      </div>
      <form onSubmit={handleUpdateProfile} className="space-y-3">
        <div>
          <label className={LABEL_CLASS}>Display Name</label>
          <input
            id="profile-name-input"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Alex Hunter"
            className={inputClass('plain')}
          />
        </div>
        <FormFeedback success={success} error={error} />
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2 disabled:opacity-50`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSubmitting ? 'Saving…' : 'Save profile'}</span>
        </button>
      </form>
    </section>
  );
};

const PasswordSection: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { value: success, flash: flashSuccess, clear: clearSuccess } = useTransientFlash<string | null>(null, 4000);
  const { isSubmitting, error, setError, handleSubmit } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update password',
    onSuccess: () => {
      flashSuccess('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    clearSuccess();
    setError(null);
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }
    return handleSubmit(e, async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    });
  };

  return (
    <section className="rounded-xl border border-line p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-fg-secondary" />
        <h3 className="text-sm font-bold text-fg">Change Password</h3>
      </div>
      <form onSubmit={handleUpdatePassword} className="space-y-3">
        <div>
          <label className={LABEL_CLASS}>New Password</label>
          <input
            id="security-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 6 characters"
            className={inputClass('plain')}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Confirm Password</label>
          <input
            id="security-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            className={inputClass('plain')}
          />
        </div>
        <FormFeedback success={success} error={error} />
        <button
          type="submit"
          disabled={isSubmitting || !newPassword}
          className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2 disabled:opacity-50`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-white" />
          <span>{isSubmitting ? 'Updating…' : 'Update password'}</span>
        </button>
      </form>
    </section>
  );
};

const FormFeedback: React.FC<{ success: string | null; error: string | null }> = ({ success, error }) => (
  <>
    {success && (
      <div className="p-2.5 bg-income-tint border border-income-line text-income rounded-lg text-xs flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{success}</span>
      </div>
    )}
    {error && (
      <div className="p-2.5 bg-expense-tint border border-expense-line text-expense rounded-lg text-xs flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    )}
  </>
);
