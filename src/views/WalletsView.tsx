import React, { useState } from 'react';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900">Wallets & Money Sources</h2>
          <p className="text-xs text-stone-500">
            Multi-currency accounts, initial balance adjustment audit trail, and atomic inter-wallet transfers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="wallet-transfer-modal-btn"
            type="button"
            onClick={() => setIsTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer Funds</span>
          </button>

          <button
            id="wallet-add-modal-btn"
            type="button"
            onClick={() => setIsAddWalletOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Wallet</span>
          </button>
        </div>
      </div>

      {/* Wallets Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeWallets.map((wallet) => {
          const Icon = getWalletIcon(wallet.type);
          return (
            <div
              key={wallet.id}
              id={`wallet-entity-${wallet.id}`}
              className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">{wallet.name}</h3>
                      <span className="text-[11px] font-medium text-stone-400 capitalize">
                        {wallet.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <button
                    id={`delete-wallet-${wallet.id}`}
                    type="button"
                    onClick={() => deleteWallet(wallet.id)}
                    title="Delete wallet"
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
                    Current Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold font-mono text-stone-900">
                      ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-stone-500 font-mono">{wallet.currency}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                <span>Created: {wallet.createdAt.slice(0, 10)}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Source
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Wallet Modal / Responsive Mobile Bottom Sheet */}
      {isAddWalletOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddWalletOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsAddWalletOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Create New Money Source</h3>
              <button
                type="button"
                onClick={() => setIsAddWalletOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:bg-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Wallet / Account Name *
                </label>
                <input
                  id="new-wallet-name"
                  type="text"
                  required
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="e.g. Robinhood Brokerage, Emergency Fund"
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Account Type
                  </label>
                  <select
                    id="new-wallet-type"
                    value={walletType}
                    onChange={(e) => setWalletType(e.target.value as WalletType)}
                    className="w-full text-xs rounded-xl border border-stone-200 px-3 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800"
                  >
                    <option value="BANK_ACCOUNT">Bank Account</option>
                    <option value="CASH">Cash</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="INVESTMENT">Investment</option>
                    <option value="E_WALLET">E-Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                    Currency
                  </label>
                  <select
                    id="new-wallet-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full text-xs rounded-xl border border-stone-200 px-3 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800 font-mono"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="THB">THB (฿)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Initial Balance ($)
                </label>
                <input
                  id="new-wallet-init-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  💡 Initial balance will be automatically recorded as an <em>Adjustment</em> transaction to preserve audit logs.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Theme Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {['#0284c7', '#16a34a', '#7c3aed', '#f59e0b', '#ef4444', '#0f172a'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setWalletColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        walletColor === c ? 'scale-125 ring-2 ring-stone-900 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="save-new-wallet-btn"
                  type="submit"
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Create Wallet & Log Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal / Responsive Mobile Bottom Sheet */}
      {isTransferOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTransferOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden -mt-1 pb-1 flex justify-center cursor-pointer" onClick={() => setIsTransferOpen(false)}>
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Transfer Between Wallets</h3>
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:bg-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  From Source Wallet
                </label>
                <select
                  id="transfer-source-wallet"
                  value={sourceWalletId}
                  onChange={(e) => setSourceWalletId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (${w.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  To Destination Wallet
                </label>
                <select
                  id="transfer-dest-wallet"
                  value={destWalletId}
                  onChange={(e) => setDestWalletId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-stone-200 px-3 py-2.5 bg-white text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {activeWallets
                    .filter((w) => w.id !== sourceWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (${w.balance.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Inline math input for transfer amount */}
              <InlineMathInput
                id="transfer-amount-math"
                label="Transfer Amount"
                placeholder="e.g. 500 or 1200/2"
                required
                onAmountEvaluated={(val, raw, valid) => {
                  setTransferAmount(val);
                  setTransferRaw(raw);
                  setTransferValid(valid);
                }}
              />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Note
                </label>
                <input
                  id="transfer-note"
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. Moving emergency buffer to savings"
                  className="w-full text-xs rounded-xl border border-stone-200 px-3.5 py-2.5 text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="pt-2">
                <button
                  id="execute-transfer-btn"
                  type="submit"
                  disabled={!transferValid || transferAmount === null || sourceWalletId === destWalletId}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    transferValid && transferAmount !== null && sourceWalletId !== destWalletId
                      ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Transfer ${transferAmount !== null ? transferAmount.toFixed(2) : '0.00'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
