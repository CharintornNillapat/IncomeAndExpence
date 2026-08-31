import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Wallet as WalletIcon, 
  ArrowLeftRight, 
  Landmark, 
  Banknote, 
  PiggyBank, 
  CreditCard, 
  Coins, 
  Trash2, 
  X,
  Sparkles
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Wallet, WalletType } from '../types';
import { InlineMathInput } from '../components/InlineMathInput';
import { AnimatedCounter } from '../components/AnimatedCounter';

export const WalletsView: React.FC = () => {
  const { wallets, totalNetWorth, addWallet, deleteWallet, addTransaction } = useFinance();

  const [isAddWalletOpen, setIsAddWalletOpen] = useState<boolean>(false);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);

  // Add Wallet Form State
  const [walletName, setWalletName] = useState<string>('');
  const [walletType, setWalletType] = useState<WalletType>('BANK_ACCOUNT');
  const [currency, setCurrency] = useState<string>('USD');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [walletColor, setWalletColor] = useState<string>('#0284c7');

  // Transfer Form State
  const [sourceWalletId, setSourceWalletId] = useState<string>(wallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState<string>(wallets[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState<number | null>(null);
  const [transferRaw, setTransferRaw] = useState<string>('');
  const [transferValid, setTransferValid] = useState<boolean>(false);
  const [transferNote, setTransferNote] = useState<string>('Funds transfer');

  const activeWallets = wallets.filter((w) => !w.isDeleted);

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'BANK_ACCOUNT': return Landmark;
      case 'CASH': return Banknote;
      case 'SAVINGS': return PiggyBank;
      case 'CREDIT_CARD': return CreditCard;
      default: return Coins;
    }
  };

  const handleCreateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) return;

    addWallet(
      {
        name: walletName.trim(),
        type: walletType,
        currency: currency.toUpperCase(),
        color: walletColor,
        icon: walletType.toLowerCase(),
      },
      initialBalance
    );

    setIsAddWalletOpen(false);
    setWalletName('');
    setInitialBalance(0);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferValid || transferAmount === null || !sourceWalletId || !destWalletId || sourceWalletId === destWalletId) {
      return;
    }

    addTransaction({
      amount: transferAmount,
      rawInput: transferRaw,
      description: transferNote || 'Transfer between wallets',
      walletId: sourceWalletId,
      destinationWalletId: destWalletId,
      type: 'TRANSFER',
      transactionDate: new Date().toISOString().slice(0, 10),
    });

    setIsTransferOpen(false);
    setTransferAmount(null);
    setTransferRaw('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Net Worth Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">Wallets & Accounts</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Manage your accounts, balances, and transfers
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="wallet-transfer-modal-btn"
            type="button"
            onClick={() => setIsTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Transfer</span>
          </button>

          <button
            id="wallet-add-modal-btn"
            type="button"
            onClick={() => setIsAddWalletOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-white dark:text-stone-900 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Add Wallet</span>
          </button>
        </div>
      </div>

      {/* Wallets Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeWallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          return (
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              key={wallet.id}
              id={`wallet-entity-${wallet.id}`}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs hover:border-stone-300 dark:hover:border-stone-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">{wallet.name}</h3>
                      <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 capitalize">
                        {wallet.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    id={`delete-wallet-${wallet.id}`}
                    type="button"
                    onClick={() => deleteWallet(wallet.id)}
                    title="Delete wallet"
                    className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 block">
                    Current Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                      <AnimatedCounter
                        value={wallet.balance}
                        currencyPrefix={wallet.currency === 'THB' ? '฿' : wallet.currency === 'EUR' ? '€' : '$'}
                        duration={0.8}
                      />
                    </div>
                    <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">{wallet.currency}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
                <span>Created: {wallet.createdAt.slice(0, 10)}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Source
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Wallet Modal / Responsive Mobile Bottom Sheet */}
      <AnimatePresence>
        {isAddWalletOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAddWalletOpen(false);
            }}
          >
            <motion.div 
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsAddWalletOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-stone-100/80 dark:border-stone-800">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Add Wallet</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setIsAddWalletOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <form onSubmit={handleCreateWallet} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                    Wallet Name *
                  </label>
                  <input
                    id="new-wallet-name"
                    type="text"
                    required
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder="e.g. Checking Account, Cash"
                    className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                      Type
                    </label>
                    <select
                      id="new-wallet-type"
                      value={walletType}
                      onChange={(e) => setWalletType(e.target.value as WalletType)}
                      className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                    >
                      <option value="BANK_ACCOUNT" className="dark:bg-stone-800 dark:text-stone-100">Bank Account</option>
                      <option value="CASH" className="dark:bg-stone-800 dark:text-stone-100">Cash</option>
                      <option value="SAVINGS" className="dark:bg-stone-800 dark:text-stone-100">Savings</option>
                      <option value="CREDIT_CARD" className="dark:bg-stone-800 dark:text-stone-100">Credit Card</option>
                      <option value="INVESTMENT" className="dark:bg-stone-800 dark:text-stone-100">Investment</option>
                      <option value="E_WALLET" className="dark:bg-stone-800 dark:text-stone-100">E-Wallet</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                      Currency
                    </label>
                    <select
                      id="new-wallet-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 font-mono transition-colors"
                    >
                      <option value="USD" className="dark:bg-stone-800 dark:text-stone-100">USD ($)</option>
                      <option value="EUR" className="dark:bg-stone-800 dark:text-stone-100">EUR (€)</option>
                      <option value="THB" className="dark:bg-stone-800 dark:text-stone-100">THB (฿)</option>
                      <option value="GBP" className="dark:bg-stone-800 dark:text-stone-100">GBP (£)</option>
                      <option value="JPY" className="dark:bg-stone-800 dark:text-stone-100">JPY (¥)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                    Starting Balance ($)
                  </label>
                  <input
                    id="new-wallet-init-balance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 font-mono focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1.5">
                    Theme Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {['#0284c7', '#16a34a', '#7c3aed', '#f59e0b', '#ef4444', '#0f172a', '#059669', '#d97706'].map((c) => (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        key={c}
                        type="button"
                        onClick={() => setWalletColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          walletColor === c ? 'scale-125 ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-2 dark:ring-offset-stone-900' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    id="save-new-wallet-btn"
                    type="submit"
                    className="w-full py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    Add Wallet
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Funds Modal / Responsive Mobile Bottom Sheet */}
      <AnimatePresence>
        {isTransferOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsTransferOpen(false);
            }}
          >
            <motion.div 
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsTransferOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700" />
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-stone-100/80 dark:border-stone-800">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">Transfer Funds</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:bg-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <form onSubmit={handleExecuteTransfer} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                      From Wallet
                    </label>
                    <select
                      id="transfer-source-wallet"
                      value={sourceWalletId}
                      onChange={(e) => setSourceWalletId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                    >
                      {activeWallets.map((w) => (
                        <option key={w.id} value={w.id} className="dark:bg-stone-800 dark:text-stone-100">
                          {w.name} (${w.balance.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                      To Wallet
                    </label>
                    <select
                      id="transfer-dest-wallet"
                      value={destWalletId}
                      onChange={(e) => setDestWalletId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                    >
                      {activeWallets
                        .filter((w) => w.id !== sourceWalletId)
                        .map((w) => (
                          <option key={w.id} value={w.id} className="dark:bg-stone-800 dark:text-stone-100">
                            {w.name} (${w.balance.toFixed(2)})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Inline math input for transfer amount */}
                <InlineMathInput
                  id="transfer-amount-math"
                  label="Transfer Amount ($)"
                  placeholder="e.g. 500 or 1200/2"
                  required
                  onAmountEvaluated={(val, raw, valid) => {
                    setTransferAmount(val);
                    setTransferRaw(raw);
                    setTransferValid(valid);
                  }}
                />

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 block mb-1">
                    Note
                  </label>
                  <input
                    id="transfer-note"
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="e.g. Savings transfer"
                    className="w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    id="execute-transfer-btn"
                    type="submit"
                    disabled={!transferValid || transferAmount === null || sourceWalletId === destWalletId}
                    className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      transferValid && transferAmount !== null && sourceWalletId !== destWalletId
                        ? 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 shadow-xs'
                        : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Transfer ${transferAmount !== null ? transferAmount.toFixed(2) : '0.00'}</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
