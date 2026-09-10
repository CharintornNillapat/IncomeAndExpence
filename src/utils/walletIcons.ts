import { Landmark, Banknote, PiggyBank, CreditCard, Coins, LucideIcon } from 'lucide-react';
import { WalletType } from '../types';

/**
 * Maps a wallet type to its display icon.
 *
 * `INVESTMENT` and `E_WALLET` currently fall through to the generic `Coins`
 * glyph - they have no dedicated icon yet, though both are offered in the
 * create-wallet form.
 */
export function getWalletIcon(type: WalletType): LucideIcon {
  switch (type) {
    case 'BANK_ACCOUNT': return Landmark;
    case 'CASH': return Banknote;
    case 'SAVINGS': return PiggyBank;
    case 'CREDIT_CARD': return CreditCard;
    default: return Coins;
  }
}
