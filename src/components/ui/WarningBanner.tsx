import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningBannerAction {
  label: string;
  onClick: () => void;
}

interface WarningBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  children: React.ReactNode;
  /** One follow-up, drawn as a link-style button after the message. */
  action?: WarningBannerAction;
}

/**
 * Spec 4.13 (ADR 0029): something the user should fix - amber is for that
 * only (spec section 3). A triangle, the message and an optional action, as a
 * `role="note"`: it informs, it does not interrupt the way an alert would.
 *
 * Adopted in the page redesign by the L5 debt warning and by the amber boxes
 * already on screen (`GuestDataNotice`, the overpayment note and
 * `transfer-overdraft-warning`), each keeping its own id or testid through the
 * pass-through props.
 */
export const WarningBanner: React.FC<WarningBannerProps> = ({ children, action, className = '', ...rest }) => (
  <div
    role="note"
    className={`flex items-start gap-2.5 p-3 rounded-inner border bg-pending-tint border-pending-line text-pending-body text-xs ${className}`.trim()}
    {...rest}
  >
    <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-pending" />
    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2">
      <span>{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center min-h-[44px] -my-3 font-semibold text-pending underline underline-offset-2 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  </div>
);
