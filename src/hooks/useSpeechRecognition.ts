import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Minimal local declarations for the Web Speech API (ADR 0018).
 *
 * These interfaces are not in TypeScript's default DOM lib, and
 * `@types/dom-speech-recognition` is deliberately NOT installed: only the
 * handful of members below are ever touched, and a package.json change for
 * zero runtime value is not worth the diff. Keep these minimal - every field
 * added here is one more thing claimed about an API this file only ever
 * feature-detects.
 */

interface SpeechAlternative {
  readonly transcript: string;
}

interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}

interface SpeechResultEvent {
  readonly results: SpeechResultList;
}

interface SpeechErrorEvent {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechCapableWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Support is two conditions, never one.
 *
 * `isSecureContext` is load-bearing, not belt-and-braces. `npm run dev
 * --host=0.0.0.0` invites the app to be opened on a phone at
 * `http://192.168.x.x:3000`, where the constructor is still present but
 * recognition cannot run - so a constructor-only check renders a button that
 * fails on tap, on exactly the device this feature exists for. Playwright
 * cannot catch this: it always runs on localhost, which is a secure context.
 *
 * Same failure shape as `crypto.randomUUID()` being undefined on an insecure
 * origin, which `CLAUDE.md` already documents.
 */
function detectSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(getRecognitionCtor()) && window.isSecureContext === true;
}

/** Thai is the app's primary language; anything the browser reports is preferred over it. */
const FALLBACK_LANG = 'th-TH';

function resolveLang(): string {
  if (typeof navigator === 'undefined') return FALLBACK_LANG;
  return navigator.language || FALLBACK_LANG;
}

export type SpeechErrorKind = 'blocked' | 'no-speech' | 'network' | 'unknown';

export interface SpeechError {
  kind: SpeechErrorKind;
  message: string;
  /**
   * `true` for a condition the user cannot resolve without leaving the page -
   * a denied permission or a missing microphone. The caller disables the
   * affordance and says why, rather than hiding it: a button that vanishes
   * the instant it is tapped is worse than one that explains itself.
   */
  disabling: boolean;
}

function toSpeechError(code: string): SpeechError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        kind: 'blocked',
        message: 'Microphone access is blocked. Allow it in your browser settings, then reload.',
        disabling: true,
      };
    case 'audio-capture':
      return {
        kind: 'blocked',
        message: 'No microphone was found.',
        disabling: true,
      };
    case 'no-speech':
      return { kind: 'no-speech', message: "Didn't catch that - try again.", disabling: false };
    case 'network':
      // Deliberately NOT disabling, mirroring `jevClassifier.ts`'s reasoning:
      // the user may be offline for a moment, and latching off would kill the
      // feature for a whole session over one dropped request.
      return { kind: 'network', message: 'Speech service unreachable. Check your connection.', disabling: false };
    default:
      return { kind: 'unknown', message: 'Speech recognition failed.', disabling: false };
  }
}

interface UseSpeechRecognitionOptions {
  /**
   * Called on every result, interim and final alike, with the full transcript
   * so far. Rebuilt from scratch each time rather than appended to, so a
   * re-delivered result cannot duplicate text.
   */
  onTranscript: (transcript: string, isFinal: boolean) => void;
}

/**
 * A thin lifecycle wrapper around the browser's own `SpeechRecognition`
 * (ADR 0018). It owns detection, configuration, the listening flag and the
 * error taxonomy - and nothing else. What the transcript *means* is the
 * caller's business: `TransactionForm` pushes it through the same
 * `handleDescriptionChange` that typing goes through, which is what makes
 * every downstream layer treat a spoken note identically to a typed one.
 *
 * Single-utterance by design (`continuous = false`): one tap, one phrase,
 * auto-stopping on silence. Continuous mode would need an explicit stop
 * affordance and a story for a session still live when the modal closes.
 */
export function useSpeechRecognition({ onTranscript }: UseSpeechRecognitionOptions) {
  // Computed once. Neither the constructor nor the secure-context flag can
  // change during a page session.
  const [isSupported] = useState<boolean>(detectSupport);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the live callback in a ref so `start` does not change identity on
  // every parent render - the same ref-mirror rationale `FinanceContext`'s
  // mutators and `useDescriptionClassifier` both use.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  /*
   * Abort any live session on unmount. This matters more than it looks:
   * `QuickAddModal` never unmounts once opened (ADR 0010's `hasOpened`
   * latch), so the form outlives its own visibility, and a session left
   * running would hold the microphone open after the modal closed.
   */
  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onstart = null;
        try {
          recognition.abort();
        } catch {
          // An abort on an already-finished session throws in some engines;
          // there is nothing to recover and nothing to report.
        }
      }
    },
    []
  );

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Same as above - stopping a session that already ended is a no-op we
      // do not want surfacing as an error.
    }
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return;

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError(null);

    const recognition = new Ctor();
    recognition.lang = resolveLang();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechResultEvent) => {
      // Rebuild the whole transcript rather than tracking `resultIndex`
      // deltas: idempotent, and correct whether or not the engine re-delivers.
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        transcript += result[0]?.transcript ?? '';
        if (result.isFinal) isFinal = true;
      }
      onTranscriptRef.current(transcript.trim(), isFinal);
    };

    recognition.onerror = (event: SpeechErrorEvent) => {
      // `aborted` is the user stopping it, or our own unmount cleanup. Neither
      // is a failure and neither should say anything.
      if (event.error === 'aborted') return;
      setError(toSpeechError(event.error));
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // Calling `start` twice throws `InvalidStateError`. Clear the handle so
      // the next tap can arm a fresh session rather than dead-locking on a
      // reference to one that never began.
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  return { isSupported, isListening, error, start, stop } as const;
}
