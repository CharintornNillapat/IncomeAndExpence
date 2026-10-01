import React from 'react';
import { IDENTITY_PALETTE, isIdentityColor } from '../../utils/identityPalette';

interface ColorGridProps {
  /** Prefixes each swatch's id: `{idPrefix}-color-{hex without #}`. */
  idPrefix: string;
  value: string;
  onChange: (hex: string) => void;
  /** `usedColors(...)` for the category in the form: lower-cased hex to the name using it. */
  used: Map<string, string>;
  /**
   * The colour the category already has when it is not one of the twelve (every
   * shipped default until spec 5.1's migration). It is offered as its own
   * swatch so a Save that changes nothing else keeps it.
   */
  currentColor?: string;
  labelId: string;
}

function swatchClass(isSelected: boolean): string {
  return `w-7 h-7 rounded-full ${isSelected ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface-1' : ''}`.trim();
}

/**
 * Spec 6.6 and L9: the twelve identity colours in six columns. A colour another
 * category uses is disabled at 0.25 opacity and named ("Rose, used by Food &
 * Dining"). Each swatch is 28px inside a 44px button; the selected one takes the
 * focus-coloured ring, not a scale.
 */
export const ColorGrid: React.FC<ColorGridProps> = ({ idPrefix, value, onChange, used, currentColor, labelId }) => {
  const showCurrent = currentColor !== undefined && !isIdentityColor(currentColor);
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-1 w-fit">
        {IDENTITY_PALETTE.map(({ hex, name }) => {
          const owner = used.get(hex.toLowerCase());
          const isSelected = value.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              id={`${idPrefix}-color-${hex.slice(1).toLowerCase()}`}
              type="button"
              disabled={!!owner}
              aria-pressed={isSelected}
              aria-label={owner ? `${name}, used by ${owner}` : name}
              title={owner ? `${name}, used by ${owner}` : name}
              onClick={() => onChange(hex)}
              className={`w-11 h-11 inline-flex items-center justify-center rounded-full ${
                owner ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span aria-hidden="true" className={swatchClass(isSelected)} style={{ backgroundColor: hex }} />
            </button>
          );
        })}
      </div>
      {showCurrent && (
        <div className="flex items-center gap-1 text-xs text-fg-secondary">
          <button
            id={`${idPrefix}-color-current`}
            type="button"
            aria-pressed={value.toLowerCase() === currentColor.toLowerCase()}
            aria-label="Current colour, from before the new palette"
            title="Current colour"
            onClick={() => onChange(currentColor)}
            className="w-11 h-11 inline-flex items-center justify-center rounded-full cursor-pointer"
          >
            <span
              aria-hidden="true"
              className={swatchClass(value.toLowerCase() === currentColor.toLowerCase())}
              style={{ backgroundColor: currentColor }}
            />
          </button>
          Current colour, from before the new palette
        </div>
      )}
    </div>
  );
};
