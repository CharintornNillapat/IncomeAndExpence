/**
 * Phase 113 (ADR 0089): each open dialog has a history entry of its own, on
 * the same URL, so Back closes the top dialog (`Modal` listens for it) instead
 * of changing the tab under it. A dialog closed any other way takes its entry
 * off again, so no Back press is spent on nothing.
 *
 * - An entry is `{ finlifeDialog: <token> }`, and a token is live while its
 *   dialog is open.
 * - A dialog that opens over an entry whose dialog has just closed (Quick Add
 *   handing off to Transfer, StrictMode's effect re-run) replaces that entry
 *   instead of pushing above it.
 * - A tab change from inside a dialog replaces the entry too (`App.tsx`).
 * - Taking an entry off is a `history.back()`, which lands a task or more
 *   later. That landing is the app's own (`isOwnTraversal`), so no dialog takes
 *   it for Back, and a dialog that opens meanwhile gets its entry once it lands.
 * - Landing on a dead entry (Forward past a closed dialog) steps back off it.
 */

const KEY = 'finlifeDialog';

// Tokens are unique per page load, so an entry left from before a reload is
// never mistaken for one of this load's dialogs.
const loadId = Math.random().toString(36).slice(2, 10);
let counter = 0;
const live = new Set<string>();

// ponytail: a back() that never lands would hold every later entry; it always
// has an entry behind it here, since the app pushed the one it leaves.
let pendingBacks = 0;
let waiting: Array<() => void> = [];
const ownTraversals = new WeakSet<Event>();

function stepBack() {
  pendingBacks += 1;
  history.back();
}

/** The token of the dialog entry this history state is, or null. */
export function dialogEntryOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const token = (state as Record<string, unknown>)[KEY];
  return typeof token === 'string' ? token : null;
}

/** Whether the entry belongs to a dialog that is open now. */
export function isLiveDialogEntry(token: string): boolean {
  return live.has(token);
}

/** Whether this `popstate` is a traversal the app made itself, not Back or Forward. */
export function isOwnTraversal(e: Event): boolean {
  return ownTraversals.has(e);
}

/** Gives an opening dialog its entry and returns the token. */
export function openDialogEntry(): string {
  const token = `${loadId}-${++counter}`;
  live.add(token);
  const enter = () => {
    if (!live.has(token)) return;
    const current = dialogEntryOf(history.state);
    const state = { [KEY]: token };
    if (current !== null && !live.has(current)) history.replaceState(state, '');
    else history.pushState(state, '');
  };
  if (pendingBacks > 0) waiting.push(enter);
  else enter();
  return token;
}

/**
 * The dialog closed. The entry is taken off a microtask later, and only if it
 * is still the current one: Back may already have left it, and a tab change,
 * another dialog or StrictMode's effect re-run of this one may have replaced it.
 */
export function closeDialogEntry(token: string): void {
  live.delete(token);
  queueMicrotask(() => {
    if (!live.has(token) && dialogEntryOf(history.state) === token) stepBack();
  });
}

if (typeof window !== 'undefined') {
  // A reload keeps the history state but no dialog is open any more.
  if (dialogEntryOf(history.state) !== null) history.replaceState(null, '');
  // Registered when the module loads, before any `Modal` listens, so it marks
  // a traversal as the app's own before a dialog reads it.
  window.addEventListener('popstate', (e) => {
    if (pendingBacks > 0) {
      pendingBacks -= 1;
      ownTraversals.add(e);
    }
    const token = dialogEntryOf(e.state);
    if (token !== null && !live.has(token)) {
      stepBack();
      return;
    }
    if (pendingBacks === 0 && waiting.length > 0) {
      const ready = waiting;
      waiting = [];
      for (const enter of ready) enter();
    }
  });
}
