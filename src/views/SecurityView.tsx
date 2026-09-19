import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Laptop, 
  Globe, 
  Trash2, 
  Lock, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Database, 
  Cloud, 
  User as UserIcon, 
  AlertCircle,
  LogOut,
  Save,
  Check
} from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { useTransientFlash } from '../hooks/useTransientFlash';
import { supabase } from '../lib/supabase';
import { LABEL_CLASS, inputClass, PRIMARY_BUTTON_COMPACT_CLASS } from '../utils/formStyles';

export const SecurityView: React.FC = () => {
  const {
    currentUser,
    isAuthenticated,
    isSyncing,
    sessions,
    currentSession,
  } = useFinanceState();
  const {
    refreshFromCloud,
    revokeSession,
    revokeAllOtherSessions,
    signOut,
  } = useFinanceActions();

  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const { value: syncFeedback, flash: flashSyncFeedback, clear: clearSyncFeedback } = useTransientFlash<string | null>(null, 3500);

  // Profile update state
  const [nameInput, setNameInput] = useState<string>(currentUser.name || '');
  const { value: profileSuccess, flash: flashProfileSuccess, clear: clearProfileSuccess } = useTransientFlash<string | null>(null, 3500);
  const { isSubmitting: isUpdatingProfile, error: profileError, handleSubmit: submitProfileUpdate } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update profile name',
    onSuccess: () => flashProfileSuccess('Profile display name updated successfully!'),
  });

  // Password change state
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const { value: passwordSuccess, flash: flashPasswordSuccess, clear: clearPasswordSuccess } = useTransientFlash<string | null>(null, 4000);
  const {
    isSubmitting: isUpdatingPassword,
    error: passwordError,
    setError: setPasswordError,
    handleSubmit: submitPasswordUpdate,
  } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update password',
    onSuccess: () => {
      flashPasswordSuccess('Password successfully updated and secured!');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    clearSyncFeedback();
    try {
      await refreshFromCloud();
      flashSyncFeedback('Data synchronized with cloud successfully!');
    } catch (err: any) {
      flashSyncFeedback('Sync completed with local cache.');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    clearProfileSuccess();

    return submitProfileUpdate(e, async () => {
      if (isAuthenticated) {
        const { error } = await supabase.auth.updateUser({
          data: { name: nameInput.trim() },
        });
        if (error) throw error;
      }
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    clearPasswordSuccess();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please verify and try again.');
      return;
    }

    return submitPasswordUpdate(e, async () => {
      if (!isAuthenticated) {
        throw new Error('Please sign in to update your cloud account password.');
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Security & Sessions</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Manage your authorized devices, security credentials, and cloud sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isManualSyncing}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isManualSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing || isManualSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>
          
          <button
            id="revoke-all-others-btn"
            type="button"
            onClick={revokeAllOtherSessions}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Revoke Other Devices</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Cloud & Supabase Auth Status Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
            isAuthenticated 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
          }`}>
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-900 dark:text-white">
                {isAuthenticated ? 'Realtime Cloud Sync Active' : 'Local Storage Mode'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                isAuthenticated ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
              }`}>
                {isAuthenticated ? 'Protected' : 'Local'}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">
              Account: <strong className="text-stone-700 dark:text-stone-200">{currentUser.email}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-stone-500 dark:text-stone-400 font-mono bg-stone-50 dark:bg-stone-800 p-2.5 rounded-xl border border-stone-100 dark:border-stone-700">
            <div>Database: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Connected</span></div>
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-stone-700 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-7): Active Devices & Authorized Sessions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Sessions Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">Active Authorized Sessions</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono">
                {sessions.filter((s) => !s.revokedAt).length} Active Device{sessions.filter((s) => !s.revokedAt).length === 1 ? '' : 's'}
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              Authorized devices currently connected to your account.
            </p>

            <div className="space-y-3">
              {sessions.filter((s) => !s.revokedAt).map((sess) => {
                const isCurrent = sess.id === currentSession?.id;
                const isMobile = sess.deviceName.toLowerCase().includes('phone') || 
                                 sess.deviceName.toLowerCase().includes('mobile') || 
                                 sess.deviceName.toLowerCase().includes('ios') ||
                                 sess.deviceName.toLowerCase().includes('android');
                const Icon = isMobile ? Smartphone : Laptop;

                return (
                  <div
                    key={sess.id}
                    id={`session-item-${sess.id}`}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
                      isCurrent ? 'border-emerald-500/60 dark:border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs' : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 sm:w-10 h-9 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isCurrent 
                            ? 'bg-emerald-600 text-white border-emerald-600' 
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-stone-900 dark:text-white truncate">{sess.deviceName}</p>
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Current Device
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                              Secondary
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 dark:text-stone-400 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-stone-400 dark:text-stone-500" /> {sess.ipAddress}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400 dark:text-stone-500" /> {new Date(sess.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        id={`revoke-session-${sess.id}`}
                        type="button"
                        onClick={() => {
                          revokeSession(sess.id);
                          flashSyncFeedback(`Session for ${sess.deviceName} terminated.`, 3000);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-800 hover:border-rose-600 rounded-lg transition-colors cursor-pointer self-start sm:self-center shrink-0"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })}

              {sessions.filter((s) => !s.revokedAt).length === 1 && (
                <div className="p-3 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200/80 dark:border-stone-700/80 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Your account is only active on this device.</span>
                </div>
              )}
            </div>
          </div>

          {/* Security & Database Info Card */}
          <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 text-xs space-y-3">
            <h4 className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-stone-700 dark:text-stone-300" /> Row-Level Security (RLS)
            </h4>
            <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
              Your financial records are protected by database row-level security policies and isolated to your account.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-white dark:bg-stone-800 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center gap-2 text-stone-800 dark:text-stone-200">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Encrypted JWT Sessions</span>
              </div>
              <div className="bg-white dark:bg-stone-800 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center gap-2 text-stone-800 dark:text-stone-200">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Encrypted Cloud Sync</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Profile & Password Security */}
        <div className="lg:col-span-5 space-y-6">
          {/* Profile Name Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">User Profile</h3>
              </div>
              <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">Profile</span>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div>
                <label className={LABEL_CLASS}>
                  Display Name
                </label>
                <input
                  id="profile-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Alex Hunter"
                  className={inputClass('plain')}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3.5 py-2.5 text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800 cursor-not-allowed font-mono"
                />
              </div>

              {profileSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">Change Password</h3>
              </div>
              <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">Security</span>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div>
                <label className={LABEL_CLASS}>
                  New Password
                </label>
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
                <label className={LABEL_CLASS}>
                  Confirm Password
                </label>
                <input
                  id="security-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputClass('plain')}
                />
              </div>

              {passwordSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdatingPassword || !newPassword}
                className={`${PRIMARY_BUTTON_COMPACT_CLASS} flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
