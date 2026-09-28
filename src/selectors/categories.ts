import { Category } from '../types';

/**
 * Spec L9 (ADR 0028): a colour one category already uses is not offered to
 * another. Maps each colour in use (lower-cased hex) to the name of the
 * category using it, for the picker's disabled state and its "… used by X"
 * label. Deleted categories free their colour, and `exceptId` frees the colour
 * of the category being edited.
 */
export function usedColors(categories: Category[], exceptId?: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const category of categories) {
    if (category.isDeleted || category.id === exceptId) continue;
    const key = category.color.toLowerCase();
    if (!used.has(key)) used.set(key, category.name);
  }
  return used;
}
