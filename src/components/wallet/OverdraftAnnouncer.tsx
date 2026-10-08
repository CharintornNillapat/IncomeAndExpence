import { useState } from 'react';
import type { Wallet } from '../../types';
import { formatCurrencyAmount } from '../../utils/currency';

/**
 * Phase 114 (ADR 0090): the overdraft warning, for a screen reader. A polite
 * status region, always mounted (a region added with its text is not read),
 * whose text is set during render only when the overdraft's key changes: the
 * paying wallet and its balance, or none. So it speaks when the warning
 * appears, when the wallet changes and when its balance does (a sync), and a
 * keystroke that only moves the amount changes nothing. It keeps the figure it
 * was announced with; the visible warning shows the current one.
 */
export function OverdraftAnnouncer({ wallet, overdrawnBy, testId }: {
  wallet: Wallet | undefined;
  overdrawnBy: number;
  testId: string;
}) {
  const key = wallet && overdrawnBy > 0 ? `${wallet.id}:${wallet.balance}` : null;
  const [spoken, setSpoken] = useState<{ key: string | null; text: string }>({ key: null, text: '' });
  if (spoken.key !== key) {
    setSpoken({
      key,
      text: key && wallet ? `This overdraws ${wallet.name} by ${formatCurrencyAmount(overdrawnBy)}.` : '',
    });
  }
  return (
    <p data-testid={testId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {spoken.text}
    </p>
  );
}
