import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { Modal } from '../Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useFinanceActions, useFinanceState } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { useTransientFlash } from '../../hooks/useTransientFlash';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { LABEL_CLASS, inputClass } from '../../utils/formStyles';
import { describeUserAgent } from '../../utils/userAgent';
import { formatLocalDateTime, todayIsoDate } from '../../utils/date';
import { buildAccountExport, saveJsonFile } from '../../utils/accountExport';
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
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null);
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
              <Button
                id="account-sync-btn"
                variant="secondary"
                onClick={handleManualSync}
                disabled={isSyncing}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
              </Button>
              <Button
                id="navbar-signout-btn"
                variant="danger"
                onClick={() => setIsConfirmingSignOut(true)}
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                <span>Sign out</span>
              </Button>
            </>
          ) : (
            <Button
              id="account-signin-btn"
              block
              onClick={() => {
                onClose();
                onRequestSignIn();
              }}
              icon={<LogIn className="w-3.5 h-3.5" />}
            >
              <span>Sign in</span>
            </Button>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 bg-income-tint border border-income-line text-income rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {deletedNotice && (
        <div
          id="account-deleted-notice"
          role="status"
          className="p-3 bg-income-tint border border-income-line text-income rounded-lg text-xs font-semibold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{deletedNotice}</span>
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

      <ExportDataSection />

      {isAuthenticated && (
        <DeleteAccountSection
          onDeleted={() =>
            setDeletedNotice('Your account and everything in it were deleted. This device is in guest mode now.')
          }
        />
      )}

      <ConfirmDialog
        isOpen={isConfirmingSignOut}
        title="Sign out of this device?"
        description="This removes your account's data from this browser, including templates saved on this device. They are not synced and cannot be recovered. Your cloud data is untouched."
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
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-fg-secondary">
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
                  <p className="text-fg-secondary mt-0.5">
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
        <Button
          id="account-signout-others-btn"
          variant="danger"
          onClick={() => setConfirming('others')}
          disabled={sessions !== null && otherSessions.length === 0}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
        >
          <span>Sign out other devices</span>
        </Button>
        <Button
          id="account-signout-everywhere-btn"
          variant="secondary"
          onClick={() => setConfirming('everywhere')}
          icon={<LogOut className="w-3.5 h-3.5" />}
        >
          <span>Sign out everywhere</span>
        </Button>
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

/**
 * Whole-account export (Phase 97, ADR 0073), for a guest and a signed-in
 * account alike. It writes what state holds, so it refuses while a cloud load
 * is running or after one failed a read: a backup missing a table, taken just
 * before a delete, would lose that table for good.
 */
const ExportDataSection: React.FC = () => {
  const { isAuthenticated, isSyncing, syncError, wallets, transactions, debts, categories, keywordRules, diaryEntries } =
    useFinanceState();
  const [error, setError] = useState<string | null>(null);
  const { value: success, flash: flashSuccess, clear: clearSuccess } = useTransientFlash<string | null>(null, 5000);

  const handleExport = () => {
    clearSuccess();
    setError(null);
    if (isAuthenticated && isSyncing) {
      setError('Your data is still loading. Export again when the sync has finished.');
      return;
    }
    if (isAuthenticated && syncError) {
      setError('Your data could not all be loaded, so the file would be incomplete. Use Sync now, then export again.');
      return;
    }
    const fileName = `finlife-export-${todayIsoDate()}.json`;
    try {
      const file = buildAccountExport(
        { wallets, transactions, debts, categories, keywordRules, diaryEntries },
        { signedIn: isAuthenticated, exportedAt: new Date() }
      );
      saveJsonFile(file, fileName);
    } catch (err) {
      console.error('[Export All Data Failed]', err);
      setError('Could not create the file. Nothing was saved.');
      return;
    }
    flashSuccess(`Saved ${fileName}.`);
  };

  return (
    <section id="account-export" className="rounded-xl border border-line p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-fg-secondary" />
        <h3 className="text-sm font-bold text-fg">Export your data</h3>
      </div>
      <p className="text-xs text-fg-secondary leading-relaxed">
        {isAuthenticated
          ? 'Downloads everything in your account as one JSON file: wallets, transactions, debts, categories, smart rules and diary entries, deleted items included. Your email, password and sign-in are not in it.'
          : 'Downloads everything stored in this browser as one JSON file: wallets, transactions, debts, categories, smart rules and diary entries, deleted items included.'}
      </p>
      <FormFeedback success={success} error={error} />
      <Button
        id="account-export-btn"
        variant="secondary"
        onClick={handleExport}
        icon={<Download className="w-3.5 h-3.5" />}
      >
        <span>Export all data (JSON)</span>
      </Button>
    </section>
  );
};

/** The phrase the person types before an account can be deleted; the server checks it too (ADR 0072). */
const DELETE_PHRASE = 'DELETE';

/**
 * Account deletion (Phase 96, ADR 0072): the one hard delete. The account, its
 * sign-in and every row go for good, so the confirmation asks for the phrase
 * typed, not a click. On success this device is signed out and cleared; the
 * section unmounts with the rest of the signed-in view, and the modal stays
 * open on guest mode with a notice.
 */
const DeleteAccountSection: React.FC<{ onDeleted: () => void }> = ({ onDeleted }) => {
  const { deleteAccount } = useFinanceActions();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteAccount(DELETE_PHRASE);
      if (!result.success) {
        setError(result.error ?? 'Could not delete your account');
        return;
      }
      setIsConfirming(false);
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section id="account-delete" className="rounded-xl border border-danger-line p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-expense" />
        <h3 className="text-sm font-bold text-fg">Delete account</h3>
      </div>
      <p className="text-xs text-fg-secondary leading-relaxed">
        Deletes your account and your sign-in, with every wallet, transaction, debt, category, smart rule and diary entry
        in it. Every device is signed out. This cannot be undone. To keep a copy, export all your data above first.
      </p>
      <Button
        id="account-delete-btn"
        variant="danger"
        onClick={() => setIsConfirming(true)}
        icon={<Trash2 className="w-3.5 h-3.5" />}
      >
        <span>Delete account</span>
      </Button>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Delete your account for good?"
        description="Your account, your sign-in and all of your data will be erased from the cloud and from this browser. Nothing can be recovered afterwards."
        confirmText="Delete account"
        confirmPhrase={DELETE_PHRASE}
        isDestructive
        isLoading={isDeleting}
        error={error}
        onConfirm={handleConfirm}
        onClose={() => {
          setIsConfirming(false);
          setError(null);
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
        <Button type="submit" block disabled={isSubmitting} icon={<Save className="w-3.5 h-3.5" />}>
          <span>{isSubmitting ? 'Saving…' : 'Save profile'}</span>
        </Button>
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
        <Button type="submit" block disabled={isSubmitting || !newPassword} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          <span>{isSubmitting ? 'Updating…' : 'Update password'}</span>
        </Button>
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
