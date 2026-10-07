// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { AuthModal } from '../src/components/AuthModal';
import { FinanceProvider } from '../src/context/FinanceContext';
import { AuthLoginSchema, AuthSignUpSchema, NewPasswordSchema, PASSWORD_MIN_LENGTH } from '../src/utils/zodSchemas';

/**
 * Phase 111 (ADR 0087, audit finding 5): a new password needs 8 characters.
 * Signing in checks only that a password was typed: an account made under the
 * old 6-character floor must still be able to sign in, so the floor applies
 * where a password is chosen (sign-up, Change Password), never where one is
 * used.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const EMAIL = 'someone@example.com';

describe('the password schemas', () => {
  it('a new password needs 8 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(NewPasswordSchema.safeParse('1234567').success).toBe(false);
    expect(NewPasswordSchema.safeParse('12345678').success).toBe(true);
    const refused = AuthSignUpSchema.safeParse({ email: EMAIL, password: 'seven77' });
    expect(refused.success).toBe(false);
    expect(refused.error!.issues[0].message).toBe('Password must be at least 8 characters');
  });

  it('signing in takes a password set under the old 6-character floor, and refuses none', () => {
    expect(AuthLoginSchema.safeParse({ email: EMAIL, password: 'six666' }).success).toBe(true);
    const empty = AuthLoginSchema.safeParse({ email: EMAIL, password: '' });
    expect(empty.success).toBe(false);
    expect(empty.error!.issues[0].message).toBe('Enter your password');
  });
});

describe('the sign-in dialog', () => {
  function open() {
    render(
      <FinanceProvider>
        <AuthModal isOpen onClose={() => {}} />
      </FinanceProvider>,
    );
    return document.getElementById('auth-password-input') as HTMLInputElement;
  }

  it('asks nothing of the length when signing in', () => {
    const password = open();
    expect(password.minLength).toBe(-1);
    expect(screen.queryByText('At least 8 characters')).toBeNull();
  });

  it('asks for 8 characters when creating an account, and says so beside the field', () => {
    open();
    fireEvent.click(document.getElementById('auth-tab-signup')!);
    const password = document.getElementById('auth-password-input') as HTMLInputElement;
    expect(password.minLength).toBe(8);
    const hint = screen.getByText('At least 8 characters');
    expect(password.getAttribute('aria-describedby')).toBe(hint.id);
  });
});
