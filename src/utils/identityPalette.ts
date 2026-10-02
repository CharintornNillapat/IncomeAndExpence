/**
 * Spec section 1's twelve muted identity colours, shared by wallets and
 * categories. None is red, green, blue, cyan or amber, which carry money
 * meaning (spec section 3). Spec 5.1's migration (Phase 63, ADR 0038) moved the
 * shipped categories and starter wallets onto them; a custom record can still
 * hold an older colour someone picked before Phase 62.
 */
export const IDENTITY_PALETTE = [
  { hex: '#D9A066', name: 'Tan' },
  { hex: '#6C8EEF', name: 'Blue' },
  { hex: '#4FB7A8', name: 'Teal' },
  { hex: '#F59E6B', name: 'Peach' },
  { hex: '#E879A6', name: 'Rose' },
  { hex: '#7DA2F0', name: 'Periwinkle' },
  { hex: '#B69CF5', name: 'Lavender' },
  { hex: '#5CC8B8', name: 'Aqua' },
  { hex: '#C7B38A', name: 'Khaki' },
  { hex: '#8FA8C8', name: 'Steel' },
  { hex: '#D98FD0', name: 'Orchid' },
  { hex: '#9C8CD9', name: 'Iris' },
] as const;

export const IDENTITY_COLORS: ReadonlyArray<string> = IDENTITY_PALETTE.map((c) => c.hex);

/** A swatch's accessible name ("Tan"); `undefined` for a colour outside the twelve. */
export function identityColorName(color: string): string | undefined {
  const key = color.toLowerCase();
  return IDENTITY_PALETTE.find((c) => c.hex.toLowerCase() === key)?.name;
}

/** Whether a stored colour is one of the twelve, compared case-insensitively. */
export function isIdentityColor(color: string): boolean {
  const key = color.toLowerCase();
  return IDENTITY_COLORS.some((hex) => hex.toLowerCase() === key);
}
