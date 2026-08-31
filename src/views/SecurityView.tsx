import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Laptop, 
  Globe, 
  Trash2, 
  Lock, 
  Unlock, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export const SecurityView: React.FC = () => {
  const { 
    sessions, 
    currentSession, 
    revokeSession, 
    revokeAllOtherSessions,
    otpPending,
    triggerOtpChallenge,
    verifyOtpCode
  } = useFinance();

  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<boolean>(false);

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const verified = verifyOtpCode(enteredOtp);
    if (verified) {
      setOtpSuccess(true);
      setEnteredOtp('');
      setTimeout(() => setOtpSuccess(false), 3000);
    } else {
      setOtpError('Invalid OTP code! Hint: try demo code "123456"');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900">Security & Session Management</h2>
          <p className="text-xs text-stone-500">
            Multi-device authorization, active JWT session revoking, and OTP step-up challenge
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="revoke-all-others-btn"
            type="button"
            onClick={revokeAllOtherSessions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Revoke All Other Devices</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Active Authorized Devices / Sessions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-stone-700" />
              <h3 className="text-sm font-bold text-stone-900">Active Authorized Sessions</h3>
            </div>
            <span className="text-xs text-stone-400 font-mono">{sessions.length} authorized</span>
          </div>

          <div className="space-y-3">
            {sessions.map((sess) => {
              const isCurrent = sess.id === currentSession?.id;
              const isMobile = sess.deviceName.toLowerCase().includes('phone') || sess.deviceName.toLowerCase().includes('mobile');
              const Icon = isMobile ? Smartphone : Laptop;

              return (
                <div
                  key={sess.id}
                  id={`session-item-${sess.id}`}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrent ? 'border-stone-900 bg-stone-50/70' : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-stone-900">{sess.deviceName}</p>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Current Device
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400 mt-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-stone-400" /> {sess.ipAddress}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" /> Active: {new Date(sess.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400 truncate max-w-xs mt-0.5">
                        Token fingerprint: {sess.id.slice(0, 16)}...
                      </p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      id={`revoke-session-${sess.id}`}
                      type="button"
                      onClick={() => revokeSession(sess.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer self-start sm:self-center"
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Step-Up OTP Multi-Factor Verification (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-stone-900">Step-Up Verification</h3>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                otpPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {otpPending ? 'Verification Required' : 'Session Verified'}
              </span>
            </div>

            <p className="text-xs text-stone-500">
              High-risk actions (such as irreversible bulk deletes or device revoking) can require a one-time step-up authorization code.
            </p>

            {otpPending ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">OTP Challenge Active</strong>
                    Enter the 6-digit confirmation code. (Demo passcode: <code>123456</code>)
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    6-Digit Security Code
                  </label>
                  <input
                    id="otp-code-input"
                    type="text"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center text-lg font-mono tracking-widest rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 focus:outline-none focus:border-stone-800"
                  />
                </div>

                {otpError && (
                  <p className="text-xs text-rose-600 font-semibold">{otpError}</p>
                )}

                <button
                  id="submit-otp-btn"
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Verify Passcode</span>
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-2">
                {otpSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Security challenge passed successfully!</span>
                  </div>
                )}

                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-stone-700 font-semibold">
                    <Lock className="w-4 h-4 text-stone-500" />
                    <span>Current Device Clearance: Standard</span>
                  </div>
                  <p className="text-stone-500 text-[11px]">
                    To simulate a high-security challenge flow, press the button below.
                  </p>
                </div>

                <button
                  id="trigger-otp-btn"
                  type="button"
                  onClick={triggerOtpChallenge}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Simulate Step-Up OTP Challenge
                </button>
              </div>
            )}
          </div>

          {/* Security Best Practices Card */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 text-xs space-y-2">
            <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-stone-600" /> Token Hygiene
            </h4>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              Tokens are tied to device fingerprints. Revoking an authorized device instantly terminates all active API and WebSocket sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
