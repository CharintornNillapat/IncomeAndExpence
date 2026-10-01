// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

/** The nine shipped categories, as a fresh provider writes them. */
function shippedCategories(): Category[] {
  return [
    { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#f87171', isSystem: true, isDeleted: false },
    { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#fb923c', isSystem: true, isDeleted: false },
    { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'car', color: '#facc15', isSystem: true, isDeleted: false },
    { id: 'cat-shopping', name: 'Shopping & Apparel', type: 'EXPENSE', icon: 'shopping-bag', color: '#a78bfa', isSystem: true, isDeleted: false },
    { id: 'cat-housing', name: 'Housing & Utilities', type: 'EXPENSE', icon: 'home', color: '#38bdf8', isSystem: true, isDeleted: false },
    { id: 'cat-salary', name: 'Primary Salary', type: 'INCOME', icon: 'briefcase', color: '#4ade80', isSystem: true, isDeleted: false },
    { id: 'cat-freelance', name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#34d399', isSystem: true, isDeleted: false },
    { id: 'cat-debt', name: 'Debt Repayment', type: 'DEBT_REPAYMENT', icon: 'credit-card', color: '#f43f5e', isSystem: true, isDeleted: false },
    { id: 'cat-adjust', name: 'Balance Adjustment', type: 'ADJUSTMENT', icon: 'sliders', color: '#94a3b8', isSystem: true, isDeleted: false },
  ];
}

const byId = (id: string) => document.getElementById(id);
const swatch = (prefix: string, hex: string) => byId(`${prefix}-color-${hex.slice(1).toLowerCase()}`) as HTMLButtonElement;
const ROSE = '#E879A6';
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
      extra: [custom({ id: 'pets', name: 'Pets', color: ROSE }), custom({ id: 'gym', name: 'Gym', color: '#D9A066' })],
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
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: ROSE, description: 'Vet and food' })] });
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
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: ROSE })] });
    const used = swatch('new-category', ROSE);
    expect(used.disabled).toBe(true);
    expect(used.getAttribute('aria-label')).toBe('Rose, used by Pets');
    expect(used.getAttribute('title')).toBe('Rose, used by Pets');
    // A strike marks it as unavailable, not just paler (audit 011 finding 1).
    expect(used.querySelector('[data-used-mark]')).not.toBeNull();
    expect(swatch('new-category', IDENTITY_PALETTE[0].hex).querySelector('[data-used-mark]')).toBeNull();
    // A new category starts on the first free colour.
    expect(swatch('new-category', IDENTITY_PALETTE[0].hex).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(byId('edit-category-pets')!);
    const own = swatch('edit-category', ROSE);
    expect(own.disabled).toBe(false);
    expect(own.getAttribute('aria-pressed')).toBe('true');
  });

  it("keeps a shipped category's older colour when Save changes only its name", async () => {
    wide();
    mount();
    fireEvent.click(byId('edit-category-cat-food')!);
    const current = byId('edit-category-color-current')!;
    expect(current.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(byId('edit-category-name')!, { target: { value: 'Eating out' } });
    fireEvent.click(byId('edit-category-save-btn')!);
    await waitFor(() => expect(byId('edit-category-cat-food')!.textContent).toContain('Eating out'));
    expect((byId('edit-category-cat-food')!.querySelector('span') as HTMLElement).style.backgroundColor).toBe('rgb(248, 113, 113)');
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

  it('disables Add once all twelve colours are in use', () => {
    wide();
    mount({ extra: IDENTITY_PALETTE.map(({ hex }, i) => custom({ id: `c${i}`, name: `Custom ${i}`, color: hex })) });
    expect((byId('save-category-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain('All 12 colors are in use');
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
    mount({ extra: [custom({ id: 'gym', name: 'Gym', color: ROSE })], rows: [tx({ categoryId: 'gym' })] });
    fireEvent.click(byId('edit-category-gym')!);
    expect((byId('delete-category-gym') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain("Used by 1 transaction, so it can't be deleted.");
  });

  it('an unused custom category is deleted after the confirm, and focus goes to the list', async () => {
    wide();
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: ROSE })] });
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
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: ROSE })] });
    fireEvent.click(byId('edit-category-pets')!);
    const sheet = screen.getByRole('dialog', { name: 'Edit category' });
    expect((within(sheet).getByLabelText('Name') as HTMLInputElement).value).toBe('Pets');
    expect(byId('new-category-name')).not.toBeNull();
  });
});

describe('the guards behind the form (guest)', () => {
  it('refuse a used colour and any edit to a System category', async () => {
    mount({ extra: [custom({ id: 'pets', name: 'Pets', color: ROSE })] });
    expect(await actions!.addCategory({ name: 'Cats', type: 'EXPENSE', color: ROSE.toLowerCase() })).toEqual({
      success: false,
      error: 'That colour is used by Pets',
    });
    expect(await actions!.updateCategory('cat-debt', { name: 'Loans' })).toEqual({
      success: false,
      error: "System categories can't be edited",
    });
    expect(byId('category-row-cat-debt')!.textContent).toContain('Debt repayment');
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
