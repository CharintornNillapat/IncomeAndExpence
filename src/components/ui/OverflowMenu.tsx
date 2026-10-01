import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface OverflowMenuItem {
  /** The item button's own id - how a page and its spec reach the action. */
  id?: string;
  label: string;
  onSelect: () => void;
  /** `danger` is red, for Delete (spec 4.14). */
  tone?: 'default' | 'danger';
  icon?: React.ReactNode;
}

interface OverflowMenuProps {
  /** Names the trigger, e.g. "More actions for Cash", and the menu. */
  label: string;
  items: OverflowMenuItem[];
  /**
   * Draws the trigger as a secondary `Button` with this text and a chevron
   * instead of the "⋯" icon: a page-level menu such as "Import / export"
   * (spec 6.2). Its visible text is then its name.
   */
  triggerLabel?: string;
  /** The trigger's id, for a menu a spec opens. */
  triggerId?: string;
  className?: string;
}

/**
 * Spec 4.14 (ADR 0029): the "⋯" menu for rare or destructive actions (Delete,
 * Archive), so a card is not a row of icons.
 *
 * - The trigger is a named `IconButton` with `aria-haspopup="menu"` and
 *   `aria-expanded`.
 * - The menu opens on click, or on ArrowDown from the trigger, and focuses its
 *   first item. Arrow keys move and wrap, Home/End jump, Escape and Tab close.
 *   Escape returns focus to the trigger. A press outside closes it.
 * - It opens instantly: DESIGN.md allows no entrance animation.
 *
 * The items exist only while the menu is open. A spec that asserts an item is
 * absent must open the menu first, or the assertion passes for the wrong
 * reason (recorded in `test-selector-contract.md`).
 */
export const OverflowMenu: React.FC<OverflowMenuProps> = ({ label, items, triggerLabel, triggerId, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const focusItem = (index: number) => {
    const count = items.length;
    if (count === 0) return;
    itemRefs.current[((index % count) + count) % count]?.focus();
  };

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Focus the first item once the menu is in the DOM.
  useEffect(() => {
    if (isOpen) focusItem(0);
  }, [isOpen]);

  // A press anywhere outside the menu and its trigger closes it.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  const onItemKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        // The menu's own Escape. Stopped here so a `Modal` around the menu
        // (the Wallets page's sheet) does not close on it too (audit 008).
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const triggerProps = {
    ref: triggerRef,
    id: triggerId,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? menuId : undefined,
    onClick: () => setIsOpen((open) => !open),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowDown' && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    },
  };

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`.trim()}>
      {triggerLabel ? (
        <Button variant="secondary" {...triggerProps}>
          {triggerLabel}
          <ChevronDown aria-hidden="true" className="w-4 h-4" />
        </Button>
      ) : (
        <IconButton label={label} {...triggerProps}>
          <MoreHorizontal className="w-4 h-4" />
        </IconButton>
      )}

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] py-1 bg-surface-3 border border-line-strong rounded-control shadow-modal"
        >
          {items.map((item, index) => (
            <button
              key={item.id ?? item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              id={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className={`w-full min-h-[44px] px-3 flex items-center gap-2 text-left text-sm font-medium hover:bg-control-active focus-visible:bg-control-active cursor-pointer ${
                item.tone === 'danger' ? 'text-expense' : 'text-fg'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
