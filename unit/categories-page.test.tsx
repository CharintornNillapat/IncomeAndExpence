// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within, act } from '@testing-library/react';
import { FinanceProvider, useFinanceActions, FinanceActionsContextType } from '../src/context/FinanceContext';
import { CategoriesView } from '../src/views/CategoriesView';
import { Navbar } from '../src/components/Navbar';
import { IDENTITY_PALETTE } from '../src/utils/identityPalette';
import type { Category, Transaction } from '../src/types';

/**
 * Phase 62 (ADR 0037, spec 6.6): the Categories page, mounted inside the real
 * `FinanceProvider` in guest mode. A fresh guest has the nine shipped
 * categories (seven Default, Debt Repayment and Balance Adjustment) and four
 * seeded keyword rules, so Food & Dining, Groceries, Transport & Fuel and
 * Primary Salary are already in use.
 *
 * jsdom has no `matchMedia`, which `useMediaQuery` reads as narrow; the wide
 * layout's tests install one that matches every query (as `wallets-page` does).
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

function wide() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function custom(overrides: Partial<Category> & Pick<Category, 'id' | 'name' | 'color'>): Category {
  return { type: 'EXPENSE', icon: 'tag', isSystem: false, isDeleted: false, ...overrides };
}

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'categoryId'>): Transaction {
  return {
    id: `seed-${overrides.categoryId}`,
    userId: 'guest',
    walletId: 'wal-cash',
    type: 'EXPENSE',
    amount: 50,
    description: 'Seeded',
    transactionDate: '2026-09-30',
    isDeleted: false,
    createdBy: 'guest',
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

let actions: FinanceActionsContextType | null = null;
function Probe() {
  actions = useFinanceActions();
  return null;
}

/** Seeds extra categories on top of the shipped ones; a stored list replaces the defaults, so it carries them too. */
function mount(options: { extra?: Category[]; rows?: Transaction[] } = {}) {
  if (options.extra) localStorage.setItem('pf_categories', JSON.stringify([...shippedCategories(), ...options.extra]));
  if (options.rows) localStorage.setItem('pf_transactions', JSON.stringify(options.rows));
  return render(
    <FinanceProvider>
      <Probe />
      <CategoriesView />
    </FinanceProvider>
  );
}

/** The nine shipped categories, as a fresh provider writes them since spec 5.1's migration (ADR 0038). */
function shippedCategories(): Category[] {
  return [
    { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#E879A6', isSystem: true, isDeleted: false },
    { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#F59E6B', isSystem: true, isDeleted: false },
    { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'car', color: '#5CC8B8', isSystem: true, isDeleted: false },
    { id: 'cat-shopping', name: 'Shopping & Apparel', type: 'EXPENSE', icon: 'shopping-bag', color: '#B69CF5', isSystem: true, isDeleted: false },
    { id: 'cat-housing', name: 'Housing & Utilities', type: 'EXPENSE', icon: 'home', color: '#7DA2F0', isSystem: true, isDeleted: false },
    { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'briefcase', color: '#8FA8C8', isSystem: true, isDeleted: false },
    { id: 'cat-freelance', name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#D98FD0', isSystem: true, isDeleted: false },
    { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'credit-card', color: '#6B7385', isSystem: true, isDeleted: false },
    { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'sliders', color: '#6B7385', isSystem: true, isDeleted: false },
  ];
}

/** The same nine as a device stored them before Phase 63, on the colours they shipped with. */
const OLD_COLORS: Record<string, string> = {
  'cat-food': '#f87171', 'cat-groceries': '#fb923c', 'cat-transport': '#facc15', 'cat-shopping': '#a78bfa', 'cat-housing': '#38bdf8',
  'cat-salary': '#4ade80', 'cat-freelance': '#34d399', 'cat-debt': '#f43f5e', 'cat-adjust': '#94a3b8',
};
const oldShippedCategories = (): Category[] => shippedCategories().map((c) => ({ ...c, color: OLD_COLORS[c.id] }));

/** A hex colour as jsdom reports an inline `backgroundColor`. */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

const byId = (id: string) => document.getElementById(id);
const swatch = (prefix: string, hex: string) => byId(`${prefix}-color-${hex.slice(1).toLowerCase()}`) as HTMLButtonElement;
/** Free on a fresh guest: the shipped nine take Rose, Peach, Periwinkle, Lavender, Aqua, Steel and Orchid. */
const BLUE = '#6C8EEF';
const RAW_ENUM = /\b(EXPENSE|INCOME|TRANSFER|DEBT_REPAYMENT|ADJUSTMENT)\b/;

describe('the page', () => {
  it('is titled "Categories", with a tablist for Categories and Smart rules', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeTruthy();
    const tabs = within(screen.getByRole('tablist', { name: 'Categories and smart rules' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Categories', 'Smart rules']);
    expect(byId('category-subtab-manage')!.getAttribute('aria-selected')).toBe('true');
  });

  it('groups the shipped categories into Expense, Income and System, and prints no raw type', () => {
    mount();
    const rows = (group: string) => [...byId(`category-group-${group}`)!.querySelectorAll('li[id^="category-row-"]')].map((li) => li.id);
    expect(rows('expense')).toHaveLength(5);
    expect(rows('income').sort()).toEqual(['category-row-cat-freelance', 'category-row-cat-salary']);
    expect(rows('system').sort()).toEqual(['category-row-cat-adjust', 'category-row-cat-debt']);
    expect(document.body.textContent).not.toMatch(RAW_ENUM);
  });

  it('locks the System rows: readable names, no button, nothing to open', () => {
    mount();
    const debt = byId('category-row-cat-debt')!;
    expect(debt.textContent).toContain('Debt repayment');
    expect(debt.textContent).toContain('Not counted as income or spending');
    expect(debt.querySelector('button')).toBeNull();
    expect(within(debt).getByRole('img', { name: 'Locked' })).toBeTruthy();
    expect(byId('category-row-cat-adjust')!.textContent).toContain('Balance adjustment');
  });

  it('tags each row Default, Custom or Custom · in use', () => {
    mount({
      extra: [custom({ id: 'pets', name: 'Pets', color: BLUE }), custom({ id: 'gym', name: 'Gym', color: '#D9A066' })],
      rows: [tx({ categoryId: 'gym' })],
    });
    expect(byId('edit-category-cat-food')!.textContent).toContain('Default');
    expect(byId('edit-category-pets')!.textContent).toMatch(/Custom$/);
    expect(byId('edit-category-gym')!.textContent).toContain('Custom · in use');
  });
});

describe('the form, from lg', () => {
  it('a row opens "Edit category" with its values, and Cancel returns to "New category"', async () => {
    wide();
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: BLUE, description: 'Vet and food' })] });
    expect(byId('category-form-heading')!.textContent).toBe('New category');

    fireEvent.click(byId('edit-category-pets')!);
    expect(byId('category-form-heading')!.textContent).toBe('Edit category');
    expect((byId('edit-category-name') as HTMLInputElement).value).toBe('Pets');
    expect((byId('edit-category-description') as HTMLTextAreaElement).value).toBe('Vet and food');
    expect(byId('edit-category-pets')!.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(document.activeElement?.id).toBe('category-form-heading'));

    fireEvent.click(byId('edit-category-cancel-btn')!);
    expect(byId('edit-category-name')).toBeNull();
    expect(byId('new-category-name')).not.toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe('edit-category-pets'));
  });

  it('L9: a colour in use is disabled and named, and the category being edited keeps its own', () => {
    wide();
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: BLUE })] });
    const used = swatch('new-category', BLUE);
    expect(used.disabled).toBe(true);
    expect(used.getAttribute('aria-label')).toBe('Blue, used by Pets');
    expect(used.getAttribute('title')).toBe('Blue, used by Pets');
    // A strike marks it as unavailable, not just paler (audit 011 finding 1).
    expect(used.querySelector('[data-used-mark]')).not.toBeNull();
    expect(swatch('new-category', IDENTITY_PALETTE[0].hex).querySelector('[data-used-mark]')).toBeNull();
    // A new category starts on the first free colour.
    expect(swatch('new-category', IDENTITY_PALETTE[0].hex).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(byId('edit-category-pets')!);
    const own = swatch('edit-category', BLUE);
    expect(own.disabled).toBe(false);
    expect(own.getAttribute('aria-pressed')).toBe('true');
  });

  it("keeps a custom category's pre-Phase-62 colour when Save changes only its name", async () => {
    wide();
    // Sky, from the old ten-colour picker: no migration touches a colour someone picked.
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: '#0ea5e9' })] });
    fireEvent.click(byId('edit-category-pets')!);
    const current = byId('edit-category-color-current')!;
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(current.getAttribute('title')).toBe('Custom color');
    expect(current.getAttribute('aria-label')).toBe('Custom color');
    fireEvent.change(byId('edit-category-name')!, { target: { value: 'Animals' } });
    fireEvent.click(byId('edit-category-save-btn')!);
    await waitFor(() => expect(byId('edit-category-pets')!.textContent).toContain('Animals'));
    expect((byId('edit-category-pets')!.querySelector('span') as HTMLElement).style.backgroundColor).toBe(rgb('#0ea5e9'));
  });

  it('shows no "Current color" swatch for a shipped category, which ships on an identity colour', () => {
    wide();
    mount();
    fireEvent.click(byId('edit-category-cat-food')!);
    expect(byId('edit-category-color-current')).toBeNull();
    expect(swatch('edit-category', '#E879A6').getAttribute('aria-pressed')).toBe('true');
  });

  it('adds an income category on a free colour, then starts the next one on Income and the next free colour', async () => {
    wide();
    mount();
    fireEvent.click(byId('new-category-type-income')!);
    fireEvent.change(byId('new-category-name')!, { target: { value: 'Allowance' } });
    fireEvent.click(byId('save-category-btn')!);
    await waitFor(() => {
      const income = [...byId('category-group-income')!.querySelectorAll('li')].map((li) => li.textContent);
      expect(income.some((text) => text?.includes('Allowance'))).toBe(true);
    });
    expect((byId('new-category-name') as HTMLInputElement).value).toBe('');
    expect(byId('new-category-type-income')!.getAttribute('aria-pressed')).toBe('true');
    expect(swatch('new-category', IDENTITY_PALETTE[0].hex).disabled).toBe(true);
    expect(swatch('new-category', IDENTITY_PALETTE[1].hex).getAttribute('aria-pressed')).toBe('true');
  });

  it('once all twelve colours are in use, lets them repeat: Add stays on and cycles to the least-shared one (audit 012 finding 1)', async () => {
    wide();
    // With the shipped seven, Rose to Orchid are each used twice, and Tan, Blue, Teal, Khaki and Iris once.
    mount({ extra: IDENTITY_PALETTE.map(({ hex }, i) => custom({ id: `c${i}`, name: `Custom ${i}`, color: hex })) });
    expect((byId('save-category-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(byId('new-category-color-sharing')!.textContent).toBe('All 12 colors are in use, so this category will share one with another.');
    const rose = swatch('new-category', '#E879A6');
    expect(rose.disabled).toBe(false);
    expect(rose.getAttribute('aria-label')).toBe('Rose, also used by Food & Dining');
    expect(rose.querySelector('[data-used-mark]')).toBeNull();
    expect(swatch('new-category', '#D9A066').getAttribute('aria-pressed')).toBe('true');

    fireEvent.change(byId('new-category-name')!, { target: { value: 'Thirteenth' } });
    fireEvent.click(byId('save-category-btn')!);
    await waitFor(() => expect(byId('category-group-expense')!.textContent).toContain('Thirteenth'));
    // Tan is now shared twice, so the next new category starts on Blue.
    await waitFor(() => expect(swatch('new-category', '#6C8EEF').getAttribute('aria-pressed')).toBe('true'));
  });

  it('lets an edit pick a used colour once all twelve are taken', async () => {
    wide();
    mount({ extra: IDENTITY_PALETTE.map(({ hex }, i) => custom({ id: `c${i}`, name: `Custom ${i}`, color: hex })) });
    // Custom 4 shares Rose with Food & Dining, so even without it all twelve stay taken.
    fireEvent.click(byId('edit-category-c4')!);
    const tan = swatch('edit-category', '#D9A066');
    expect(tan.disabled).toBe(false);
    expect(tan.getAttribute('aria-label')).toBe('Tan, also used by Custom 0');
    fireEvent.click(tan);
    fireEvent.click(byId('edit-category-save-btn')!);
    await waitFor(() => expect((byId('edit-category-c4')!.querySelector('span') as HTMLElement).style.backgroundColor).toBe(rgb('#D9A066')));
  });
});

describe('delete, from lg', () => {
  it('a default has no Delete, and says why', () => {
    wide();
    mount();
    fireEvent.click(byId('edit-category-cat-housing')!);
    expect(byId('delete-category-cat-housing')).toBeNull();
    expect(document.body.textContent).toContain("Default categories can't be deleted.");
  });

  it('a custom category in use has Delete disabled, with what uses it', () => {
    wide();
    mount({ extra: [custom({ id: 'gym', name: 'Gym', color: BLUE })], rows: [tx({ categoryId: 'gym' })] });
    fireEvent.click(byId('edit-category-gym')!);
    expect((byId('delete-category-gym') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain("Used by 1 transaction, so it can't be deleted.");
  });

  it('an unused custom category is deleted after the confirm, and focus goes to the list', async () => {
    wide();
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: BLUE })] });
    fireEvent.click(byId('edit-category-pets')!);
    fireEvent.click(byId('delete-category-pets')!);
    const dialog = screen.getByRole('dialog', { name: 'Delete category' });
    expect(dialog.textContent).toContain('No transaction or rule uses it.');
    fireEvent.click(byId('confirm-destructive-btn')!);
    await waitFor(() => expect(byId('category-row-pets')).toBeNull());
    expect(byId('category-form-heading')!.textContent).toBe('New category');
    await waitFor(() => expect(document.activeElement?.id).toBe('category-list-heading'));
  });
});

describe('below lg', () => {
  it('offers "Add category" in the header, which takes focus to the New form (audit 011 finding 2)', () => {
    mount();
    const open = byId('open-new-category-btn')!;
    expect(open.textContent).toBe('Add category');
    fireEvent.click(open);
    expect(document.activeElement?.id).toBe('new-category-name');
    // Not on the Smart rules tab, where there is no form to go to.
    fireEvent.click(byId('category-subtab-rules')!);
    expect(byId('open-new-category-btn')).toBeNull();
  });

  it('does not offer it from lg, where the form sits beside the list', () => {
    wide();
    mount();
    expect(byId('open-new-category-btn')).toBeNull();
  });

  it('a row opens the edit form in a sheet, and the new form stays on the page', () => {
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: BLUE })] });
    fireEvent.click(byId('edit-category-pets')!);
    const sheet = screen.getByRole('dialog', { name: 'Edit category' });
    expect((within(sheet).getByLabelText('Name') as HTMLInputElement).value).toBe('Pets');
    expect(byId('new-category-name')).not.toBeNull();
  });
});

describe('the guards behind the form (guest)', () => {
  it('refuse a used colour and any edit to a System category', async () => {
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: BLUE })] });
    expect(await actions!.addCategory({ name: 'Cats', type: 'EXPENSE', color: BLUE.toLowerCase() })).toEqual({
      success: false,
      error: 'That colour is used by Pets',
    });
    expect(await actions!.updateCategory('cat-debt', { name: 'Loans' })).toEqual({
      success: false,
      error: "System categories can't be edited",
    });
    expect(byId('category-row-cat-debt')!.textContent).toContain('Debt repayment');
  });

  it('accept a repeated colour once all twelve are taken, and still refuse one before that', async () => {
    mount({ extra: IDENTITY_PALETTE.slice(0, 11).map(({ hex }, i) => custom({ id: `c${i}`, name: `Custom ${i}`, color: hex })) });
    // Iris is still free, so Rose is refused.
    expect((await actions!.addCategory({ name: 'Early', type: 'EXPENSE', color: '#E879A6' })).success).toBe(false);
    expect((await actions!.addCategory({ name: 'Last free', type: 'EXPENSE', color: '#9C8CD9' })).success).toBe(true);
    // Let it land, as a person's next tap would, before the guard reads it.
    // The row on screen is not enough: the guard reads `categoriesRef`, which
    // a passive effect updates after that render, and under a loaded full
    // run the effect had not run yet (ADR 0055). React runs pending effects
    // before it handles a new tap; `act` does the same here.
    await waitFor(() => expect(byId('category-group-expense')!.textContent).toContain('Last free'));
    await act(async () => {});
    expect((await actions!.addCategory({ name: 'Repeat', type: 'EXPENSE', color: '#E879A6' })).success).toBe(true);
  });
});

describe('the Smart rules tab', () => {
  it('names types in words, in the picker and the sandbox', () => {
    mount();
    fireEvent.click(byId('category-subtab-rules')!);
    const options = [...(byId('keyword-category-select') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toContain('Groceries (Expense)');
    expect(options).toContain('Debt repayment');
    expect(document.body.textContent).not.toMatch(RAW_ENUM);
  });
});

describe('the header nav (audit 007 finding 1)', () => {
  it('shows tab labels from 1280 and icons below it', () => {
    wide();
    render(
      <FinanceProvider>
        <Navbar activeTab="categories" setActiveTab={() => {}} onOpenQuickAdd={() => {}} onOpenAuth={() => {}} onOpenAccount={() => {}} />
      </FinanceProvider>
    );
    const tab = byId('nav-tab-categories')!;
    expect(tab.querySelector('span')!.className).toBe('sr-only xl:not-sr-only');
    expect(tab.querySelector('svg')!.getAttribute('class')).toContain('xl:hidden');
    expect(tab.getAttribute('title')).toBe('Categories');
  });
});

describe("spec 5.1's colour migration on this device (Phase 63, ADR 0038)", () => {
  const dot = (id: string) => (byId(`edit-category-${id}`)!.querySelector('span') as HTMLElement).style.backgroundColor;
  const systemDot = (id: string) => (byId(`category-row-${id}`)!.querySelector('span') as HTMLElement).style.backgroundColor;

  it('loads the shipped categories a device stored on their old colours on the identity colours', () => {
    localStorage.setItem('pf_categories', JSON.stringify(oldShippedCategories()));
    mount();
    expect(dot('cat-food')).toBe(rgb('#E879A6'));
    expect(dot('cat-groceries')).toBe(rgb('#F59E6B'));
    expect(dot('cat-transport')).toBe(rgb('#5CC8B8'));
    expect(dot('cat-salary')).toBe(rgb('#8FA8C8'));
    expect(dot('cat-freelance')).toBe(rgb('#D98FD0'));
    expect(systemDot('cat-debt')).toBe(rgb('#6B7385'));
  });

  it('gives a shipped category the first free colour when its own is taken (L9), and leaves a picked colour alone', () => {
    wide();
    localStorage.setItem('pf_categories', JSON.stringify([
      ...oldShippedCategories(),
      custom({ id: 'pets', name: 'Pets', color: '#E879A6' }),
      custom({ id: 'gym', name: 'Gym', color: '#0ea5e9' }),
    ]));
    mount();
    expect(dot('cat-food')).toBe(rgb('#D9A066')); // Tan: Pets already holds Rose
    expect(dot('pets')).toBe(rgb('#E879A6'));
    expect(dot('gym')).toBe(rgb('#0ea5e9'));
    expect(swatch('new-category', '#D9A066').getAttribute('aria-label')).toBe('Tan, used by Food & Dining');
  });

  it('starts a fresh guest on identity colours only, one each', () => {
    mount();
    const colors = shippedCategories().filter((c) => c.type === 'EXPENSE' || c.type === 'INCOME').map((c) => dot(c.id));
    const identity = IDENTITY_PALETTE.map(({ hex }) => rgb(hex));
    expect(colors.every((c) => identity.includes(c))).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
