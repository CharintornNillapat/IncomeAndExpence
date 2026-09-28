import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthLoginSchema, formatZodIssues } from '../utils/zodSchemas';
import { Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2, ArrowRight, X, KeyRound } from 'lucide-react';
import { Modal } from './Modal';
import { LABEL_TEXT_CLASS } from '../utils/formStyles';
import { SegmentedControl } from './ui/SegmentedControl';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { GuestDataNotice } from './account/GuestDataNotice';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// T75: this component does not subscribe to finance context, so `React.memo`
// isn't defeated the way CLAUDE.md warns a context subscriber would defeat it
// - `MainApp` (its only parent) re-renders on every tab-cycle/UI-state change,
// and this stops that from re-rendering `AuthModal` when neither of its two
// props actually changed. The one child that does subscribe,
// `GuestDataNotice` (ADR 0024), subscribes for itself and only while the
// modal is open, so a ledger write re-renders the notice, never this.
export const AuthModal: React.FC<AuthModalProps> = React.memo(({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMessage(
        'Cloud sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
          'to your .env file to sign in. Your data is saved locally in the meantime.'
      );
      return;
    }

    // Validate credentials before the network round-trip. A password reset only
    // needs the address, so the password rule is dropped for that mode.
    const credentials = { email: email.trim(), password };
    const validation =
      mode === 'forgot'
        ? AuthLoginSchema.pick({ email: true }).safeParse(credentials)
        : AuthLoginSchema.safeParse(credentials);

    if (!validation.success) {
      setErrorMessage(formatZodIssues(validation.error));
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              name: name.trim() || email.split('@')[0],
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMessage('Account created and logged in successfully! Syncing your data...');
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          setSuccessMessage('Sign up successful! Please check your email to confirm your account or sign in.');
        }
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) throw error;

        setSuccessMessage('Signed in successfully! Connecting real-time sync...');
        setTimeout(() => {
          onClose();
        }, 800);
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setSuccessMessage('Password reset instructions sent to your email.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-line shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-brand-tint text-brand flex items-center justify-center border border-brand-line">
          <Lock className="w-4 h-4 text-brand" />
        </div>
        <div>
          <h3 id="auth-modal-title" className="text-base font-bold text-fg">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h3>
          <p className="text-xs text-fg-secondary">Sync your finances across devices</p>
        </div>
      </div>
      <IconButton id="auth-close-btn" label="Close" onClick={onClose}>
        <X className="w-5 h-5" />
      </IconButton>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} header={header} titleId="auth-modal-title" bodyClassName="space-y-5">
      {/* Mode Toggle Tabs */}
      {mode !== 'forgot' && (
        <SegmentedControl<'signin' | 'signup'>
          size="sm"
          fill
          ariaLabel="Sign in or create an account"
          value={mode === 'signup' ? 'signup' : 'signin'}
          onChange={(next) => {
            setMode(next);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          options={[
            { value: 'signin', id: 'auth-tab-signin', label: 'Sign In' },
            { value: 'signup', id: 'auth-tab-signup', label: 'Create Account' },
          ]}
        />
      )}

      {/* F5 policy: signing in replaces the guest ledger (ADR 0024). */}
      {mode !== 'forgot' && <GuestDataNotice />}

      {/* Feedback alerts */}
      {errorMessage && (
        <div className="p-3 bg-expense-tint border border-expense-line rounded-lg text-xs text-expense flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-expense shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-income-tint border border-income-line rounded-lg text-xs text-income flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-income shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleAuth} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className={LABEL_TEXT_CLASS}>Full Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-fg-muted absolute left-3 top-3" />
              <input
                id="auth-name-input"
                type="text"
                required
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-line-input rounded-lg text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className={LABEL_TEXT_CLASS}>Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-fg-muted absolute left-3 top-3" />
            <input
              id="auth-email-input"
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-line-input rounded-lg text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={LABEL_TEXT_CLASS}>Password</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  id="auth-forgot-password-link"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-fg-secondary hover:text-fg underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-fg-muted absolute left-3 top-3" />
              <input
                id="auth-password-input"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-surface-2 border border-line-input rounded-lg text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>
          </div>
        )}

        <Button type="submit" id="auth-submit-btn" size="lg" block disabled={loading} className="sm:text-sm">
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>
                {mode === 'signin'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        {mode === 'forgot' && (
          <button
            type="button"
            id="auth-back-to-signin-link"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full text-center text-xs text-fg-secondary hover:text-fg underline pt-1 cursor-pointer"
          >
            Back to Sign In
          </button>
        )}
      </form>

      <div className="pt-2 border-t border-line text-center">
        <p className="text-[11px] text-fg-muted">
          Encrypted with Supabase & Row Level Security
        </p>
      </div>
    </Modal>
  );
});

AuthModal.displayName = 'AuthModal';
