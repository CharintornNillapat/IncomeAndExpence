import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthLoginSchema, formatZodIssues } from '../utils/zodSchemas';
import { Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2, ArrowRight, X, KeyRound } from 'lucide-react';
import { Modal } from './Modal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
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
    <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-100/80 dark:border-stone-800 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center shadow-xs border border-stone-700">
          <Lock className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 id="auth-modal-title" className="text-base font-bold text-stone-900 dark:text-white">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Sync your finances across devices</p>
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        type="button"
        id="auth-close-btn"
        onClick={onClose}
        className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
      >
        <X className="w-5 h-5" />
      </motion.button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} header={header} titleId="auth-modal-title" bodyClassName="space-y-5">
      {/* Mode Toggle Tabs */}
      {mode !== 'forgot' && (
        <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl gap-1 border border-stone-200 dark:border-stone-700">
          <button
            type="button"
            id="auth-tab-signin"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="auth-tab-signup"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Feedback alerts */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleAuth} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Full Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3" />
              <input
                id="auth-name-input"
                type="text"
                required
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:bg-white dark:focus:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-900 dark:focus:border-stone-400"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3" />
            <input
              id="auth-email-input"
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:bg-white dark:focus:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-900 dark:focus:border-stone-400"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Password</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  id="auth-forgot-password-link"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-3" />
              <input
                id="auth-password-input"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:bg-white dark:focus:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-900 dark:focus:border-stone-400"
              />
            </div>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="submit"
          id="auth-submit-btn"
          disabled={loading}
          className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white dark:border-stone-900 border-t-transparent rounded-full animate-spin" />
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
        </motion.button>

        {mode === 'forgot' && (
          <button
            type="button"
            id="auth-back-to-signin-link"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full text-center text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline pt-1 cursor-pointer"
          >
            Back to Sign In
          </button>
        )}
      </form>

      <div className="pt-2 border-t border-stone-100 dark:border-stone-800 text-center">
        <p className="text-[11px] text-stone-400 dark:text-stone-500">
          Encrypted with Supabase & Row Level Security
        </p>
      </div>
    </Modal>
  );
};
