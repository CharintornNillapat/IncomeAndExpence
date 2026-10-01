/**
 * Spec section 1's twelve muted identity colours, shared by wallets and
 * categories. None is red, green, blue, cyan or amber, which carry money
 * meaning (spec section 3). Records that already hold an older colour keep it
 * until spec 5.1's migration (Phase 63).
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

/** Whether a stored colour is one of the twelve, compared case-insensitively. */
export function isIdentityColor(color: string): boolean {
  const key = color.toLowerCase();
  return IDENTITY_COLORS.some((hex) => hex.toLowerCase() === key);
}
