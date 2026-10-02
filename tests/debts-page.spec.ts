import { test, expect, Page } from '@playwright/test';
import { gotoTab, seedLedger, SAMPLE_WALLETS, SAMPLE_STUDENT_LOAN } from './helpers';

/**
 * The Debt payoff page (Phase 60, spec 6.4, ADR 0035), as a guest. A fresh
 * context has no debt and ฿0.00 wallets (ADR 0040), so each test seeds the
 * sample Student Loan (฿4,500.00 of ฿10,000.00 still owed, due 2026-12-31) and
 * the sample wallets, which hold ฿7,650.00 across 3 wallets.
 *
 * Nothing is intercepted.
 */
const studentLoan = (page: Page) => page.locator('div[id^="debt-card-"]').filter({ hasText: 'Student Loan' });

async function addDebt(page: Page, name: string, dueDate: string) {
  await page.locator('#open-add-debt-btn').click();
  await page.locator('#new-debt-name').fill(name);
  await page.locator('#new-debt-due-date').fill(dueDate);
  await page.locator('#save-new-debt-btn').click();
  await expect(page.locator('div[id^="debt-card-"]').filter({ hasText: name })).toBeVisible();
}

test.describe('The Debt payoff page', () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, { wallets: SAMPLE_WALLETS, debts: [SAMPLE_STUDENT_LOAN] });
    await page.goto('/');
    await gotoTab(page, 'debts');
  });

  test('Mark as paid off asks first, then moves the debt to Paid off without moving money', async ({ page }) => {
    await expect(page.getByText('1 active debt · sorted by due date')).toBeVisible();

    await studentLoan(page).locator('button[id^="settle-debt-"]').click();
    const dialog = page.getByRole('dialog', { name: 'Mark as paid off' });
    await expect(dialog).toContainText('without recording a payment or moving money');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('section[aria-label="Active debts"]')).toContainText('Student Loan');

    await studentLoan(page).locator('button[id^="settle-debt-"]').click();
    await page.locator('#confirm-destructive-btn').click();

    const paidOff = page.getByRole('region', { name: 'Paid off (1)' });
    await expect(paidOff).toContainText('Student Loan');
    await expect(studentLoan(page)).toContainText('✓ Debt Fully Settled');
    await expect(page.getByText('No active debts')).toBeVisible();

    // A write-off records no payment: every wallet keeps its balance.
    await gotoTab(page, 'wallets');
    await expect(page.getByText('฿7,650.00 across 3 wallets')).toBeVisible();
  });

  test('Edit refuses a borrowed total below what is still owed, then renames the debt, which survives a reload', async ({ page }) => {
    const name = `E2E Edited Loan ${Date.now().toString().slice(-6)}`;
    await studentLoan(page).locator('button[id^="debt-menu-btn-"]').click();
    await studentLoan(page).locator('button[id^="edit-debt-"]').click();

    const dialog = page.getByRole('dialog', { name: 'Edit debt' });
    await expect(page.locator('#edit-debt-name')).toHaveValue('Student Loan');
    await page.locator('#edit-debt-total').fill('4000');
    await page.locator('#save-edit-debt-btn').click();
    await expect(page.locator('#edit-debt-error')).toHaveText("Borrowed can't be less than what is still owed (฿4,500.00)");
    await expect(dialog).toBeVisible();

    await page.locator('#edit-debt-name').fill(name);
    await page.locator('#edit-debt-total').fill('12000');
    await page.locator('#save-edit-debt-btn').click();
    await expect(dialog).not.toBeVisible();

    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: name });
    await expect(card).toContainText('฿12,000.00');
    await expect(card).toContainText('฿4,500.00');

    await page.reload();
    await gotoTab(page, 'debts');
    await expect(card).toContainText('฿12,000.00');
    await expect(card).toContainText('฿4,500.00');
  });

  test('active debts are listed nearest due date first', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const later = `E2E Later ${suffix}`;
    const sooner = `E2E Sooner ${suffix}`;
    // Added in the opposite order to the one the page shows.
    await addDebt(page, later, '2030-06-30');
    await addDebt(page, sooner, '2029-01-31');

    const names = await page.locator('section[aria-label="Active debts"] div[id^="debt-card-"] h3').allTextContents();
    expect(names).toEqual(['Student Loan', sooner, later]);
    await expect(page.getByText('3 active debts · sorted by due date')).toBeVisible();
  });
});
