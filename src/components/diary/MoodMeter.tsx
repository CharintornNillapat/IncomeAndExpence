import React from 'react';
import { MOOD_LEVELS } from './diaryLabels';

/**
 * Five bars, filled up to the day's mood (spec 6.1 and 6.5). No emoji; the
 * accessible name carries the number. Shared by the Dashboard's Mood &
 * spending card and the diary's recent entries.
 */
export const MoodMeter: React.FC<{ mood: number }> = ({ mood }) => (
  <span role="img" aria-label={`Mood ${mood} of 5`} className="flex gap-[3px]">
    {MOOD_LEVELS.map((step) => (
      <span key={step} className={`w-3.5 h-1.5 rounded-full ${step <= mood ? 'bg-brand' : 'bg-line-strong'}`} />
    ))}
  </span>
);
