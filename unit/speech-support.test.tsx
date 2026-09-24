// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSpeechRecognition } from '../src/hooks/useSpeechRecognition';

/**
 * Phase 46's coverage gap (ADR 0021).
 *
 * `tests/voice-input.spec.ts` covers the mic end to end, but two things are
 * structurally out of its reach:
 *
 *   1. **The `isSecureContext` branch.** Playwright always runs on
 *      `localhost`, which IS a secure context. There is no browser
 *      configuration that makes it otherwise. Yet this is the branch that
 *      decides whether a phone opening `http://192.168.x.x:3000` — the exact
 *      device the feature exists for, invited there by `npm run dev
 *      --host=0.0.0.0` — sees a button that fails on tap.
 *   2. **The error taxonomy.** Firing a real `audio-capture` needs a machine
 *      with no microphone; `service-not-allowed` needs a hostile browser
 *      policy. Both are one line here.
 *
 * Nothing in `src/` was widened for this. `detectSupport` and `toSpeechError`
 * stay module-private and are driven entirely through the hook's public
 * `isSupported` and `error`.
 */

interface FakeInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: Array<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

let instances: FakeInstance[] = [];
/** When set, `start()` throws it — the `InvalidStateError` path. */
let startThrows: Error | null = null;

function makeCtor() {
  return function FakeRecognition(this: FakeInstance) {
    const self = this;
    self.lang = '';
    self.continuous = false;
    self.interimResults = false;
    self.onresult = null;
    self.onerror = null;
    self.onend = null;
    self.onstart = null;
    self.start = vi.fn(() => {
      if (startThrows) throw startThrows;
      self.onstart?.();
    });
    self.stop = vi.fn(() => {
      self.onend?.();
    });
    self.abort = vi.fn();
    instances.push(self);
  } as unknown as new () => FakeInstance;
}

/** Installs a constructor under the given key, and nothing under the other. */
function installSpeech(key: 'SpeechRecognition' | 'webkitSpeechRecognition' = 'SpeechRecognition') {
  vi.stubGlobal(key, makeCtor());
}

function setSecure(secure: boolean) {
  vi.stubGlobal('isSecureContext', secure);
}

/** A results payload shaped like a `SpeechRecognitionResultList`. */
function resultEvent(parts: Array<[string, boolean]>) {
  return { results: parts.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal })) };
}

function renderVoice(onTranscript = vi.fn()) {
  const view = renderHook(() => useSpeechRecognition({ onTranscript }));
  return { ...view, onTranscript };
}

beforeEach(() => {
  instances = [];
  startThrows = null;
  // Neither constructor exists unless a test installs one. jsdom ships
  // neither, but stubbing both ways keeps each test's premise explicit.
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  setSecure(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('support detection is two conditions, never one', () => {
  it('reports unsupported when neither constructor exists', () => {
    const { result } = renderVoice();
    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported with the unprefixed constructor in a secure context', () => {
    installSpeech('SpeechRecognition');
    const { result } = renderVoice();
    expect(result.current.isSupported).toBe(true);
  });

  it('reports supported with the webkit-prefixed constructor too', () => {
    installSpeech('webkitSpeechRecognition');
    const { result } = renderVoice();
    expect(result.current.isSupported).toBe(true);
  });

  it('reports UNSUPPORTED on an insecure origin even though the constructor exists', () => {
    /*
     * THE TEST THIS FILE EXISTS FOR.
     *
     * A constructor-only check renders a mic button that throws on tap at
     * `http://192.168.x.x:3000`. Playwright cannot reach this branch — it
     * always runs on localhost, a secure context — so before this test the
     * condition was carried by a code comment and nothing else.
     *
     * Same failure shape as `crypto.randomUUID()` being undefined on an
     * insecure origin, which `CLAUDE.md` already documents.
     */
    installSpeech('SpeechRecognition');
    setSecure(false);

    const { result } = renderVoice();

    expect(result.current.isSupported).toBe(false);
  });

  it('start() does not re-check support — the caller\'s render gate is the guarantee', () => {
    /*
     * FOUND BY THIS TEST, and pinned as-is rather than changed.
     *
     * `start()` checks only for a constructor, never `isSupported`. So on an
     * insecure origin — constructor present, `isSecureContext` false — calling
     * it DOES arm a session and DOES report listening, against a recognizer
     * that cannot actually run.
     *
     * That is unreachable in the app: `TransactionForm.tsx:701` renders the
     * mic behind `{isVoiceSupported && ...}`, so nothing can call `start()`
     * when support is false. The contract is real but held one layer up,
     * which means a future caller that forgets the gate gets a button that
     * lights up and never hears anything.
     *
     * Recorded in ADR 0021 as a residual. Hardening `start()` is a behaviour
     * change and belongs to a phase that decides it deliberately — this one
     * describes what ships.
     */
    setSecure(false);
    installSpeech('SpeechRecognition');

    const { result } = renderVoice();
    expect(result.current.isSupported).toBe(false);

    act(() => result.current.start());

    expect(instances).toHaveLength(1);
    expect(result.current.isListening).toBe(true);
  });
});

describe('session lifecycle', () => {
  beforeEach(() => installSpeech());

  it('configures a single-utterance session with interim results', () => {
    const { result } = renderVoice();
    act(() => result.current.start());

    expect(instances).toHaveLength(1);
    expect(instances[0].continuous).toBe(false);
    expect(instances[0].interimResults).toBe(true);
    expect(instances[0].lang).toBe(navigator.language);
  });

  it('flags listening between onstart and onend', () => {
    const { result } = renderVoice();

    expect(result.current.isListening).toBe(false);
    act(() => result.current.start());
    expect(result.current.isListening).toBe(true);

    act(() => instances[0].onend?.());
    expect(result.current.isListening).toBe(false);
  });

  it('does not arm a second session while one is live', () => {
    const { result } = renderVoice();

    act(() => result.current.start());
    act(() => result.current.start());

    expect(instances).toHaveLength(1);
  });

  it('re-arms after the previous session ended', () => {
    const { result } = renderVoice();

    act(() => result.current.start());
    act(() => instances[0].onend?.());
    act(() => result.current.start());

    expect(instances).toHaveLength(2);
  });

  it('clears the handle when start throws, so the next tap still works', () => {
    /*
     * Calling `start` twice throws `InvalidStateError` in some engines. If the
     * handle were left set, the ref would point at a session that never began
     * and every later tap would return early - the button would be dead for
     * the rest of the form's life, with nothing on screen explaining it.
     */
    startThrows = new DOMException('already started', 'InvalidStateError');
    const { result } = renderVoice();

    act(() => result.current.start());
    expect(result.current.isListening).toBe(false);

    startThrows = null;
    act(() => result.current.start());

    expect(instances).toHaveLength(2);
    expect(result.current.isListening).toBe(true);
  });

  it('stop() is a no-op when nothing is running', () => {
    const { result } = renderVoice();
    expect(() => act(() => result.current.stop())).not.toThrow();
    expect(instances).toHaveLength(0);
  });

  it('aborts a live session on unmount and detaches every handler', () => {
    /*
     * `QuickAddModal` never unmounts once opened (ADR 0010's `hasOpened`
     * latch), so the form outlives its own visibility. A session left running
     * would hold the microphone open after the modal closed.
     */
    const { result, unmount } = renderVoice();
    act(() => result.current.start());
    const instance = instances[0];

    unmount();

    expect(instance.abort).toHaveBeenCalledTimes(1);
    expect(instance.onresult).toBeNull();
    expect(instance.onerror).toBeNull();
    expect(instance.onend).toBeNull();
    expect(instance.onstart).toBeNull();
  });
});

describe('transcripts are rebuilt, never appended', () => {
  beforeEach(() => installSpeech());

  it('assembles every result into one trimmed transcript', () => {
    const { result, onTranscript } = renderVoice();
    act(() => result.current.start());

    act(() => instances[0].onresult?.(resultEvent([['ข้าวมันไก่ ', false], ['60', false]])));

    expect(onTranscript).toHaveBeenCalledWith('ข้าวมันไก่ 60', false);
  });

  it('reports isFinal once any result is final', () => {
    const { result, onTranscript } = renderVoice();
    act(() => result.current.start());

    act(() => instances[0].onresult?.(resultEvent([['coffee 120', true]])));

    expect(onTranscript).toHaveBeenCalledWith('coffee 120', true);
  });

  it('is idempotent when the engine re-delivers the same results', () => {
    // Rebuilt from scratch each time rather than tracking `resultIndex`
    // deltas, so a re-delivery cannot duplicate text.
    const { result, onTranscript } = renderVoice();
    act(() => result.current.start());

    const event = resultEvent([['coffee', false]]);
    act(() => instances[0].onresult?.(event));
    act(() => instances[0].onresult?.(event));

    expect(onTranscript).toHaveBeenNthCalledWith(1, 'coffee', false);
    expect(onTranscript).toHaveBeenNthCalledWith(2, 'coffee', false);
  });
});

describe('the error taxonomy decides whether the button survives', () => {
  beforeEach(() => installSpeech());

  function fireError(code: string) {
    const { result } = renderVoice();
    act(() => result.current.start());
    act(() => instances[0].onerror?.({ error: code }));
    return result;
  }

  it('treats a denied permission as disabling, with a recoverable instruction', () => {
    const result = fireError('not-allowed');

    expect(result.current.error).toEqual({
      kind: 'blocked',
      message: 'Microphone access is blocked. Allow it in your browser settings, then reload.',
      disabling: true,
    });
  });

  it('treats a browser-policy denial as disabling', () => {
    expect(fireError('service-not-allowed').current.error).toMatchObject({
      kind: 'blocked',
      disabling: true,
    });
  });

  it('treats a missing microphone as disabling', () => {
    /* Needs a machine with no audio input to reproduce in a browser. */
    expect(fireError('audio-capture').current.error).toEqual({
      kind: 'blocked',
      message: 'No microphone was found.',
      disabling: true,
    });
  });

  it('treats silence as retryable, not disabling', () => {
    expect(fireError('no-speech').current.error).toMatchObject({
      kind: 'no-speech',
      disabling: false,
    });
  });

  it('does NOT latch off on a network error', () => {
    /*
     * Deliberate, and mirroring `jevClassifier`'s reasoning: the user may be
     * offline for a moment, and latching would kill the feature for a whole
     * session over one dropped request. The inverse of this assertion is the
     * bug, which is why it is pinned rather than assumed.
     */
    expect(fireError('network').current.error).toMatchObject({
      kind: 'network',
      disabling: false,
    });
  });

  it('degrades an unrecognised code to a non-disabling unknown', () => {
    expect(fireError('some-future-error-code').current.error).toMatchObject({
      kind: 'unknown',
      disabling: false,
    });
  });

  it('says nothing at all when the user aborts', () => {
    // `aborted` is the user stopping it, or our own unmount cleanup. Neither
    // is a failure and neither should surface.
    expect(fireError('aborted').current.error).toBeNull();
  });

  it('clears a previous error when a new session starts', () => {
    const { result } = renderVoice();

    act(() => result.current.start());
    act(() => instances[0].onerror?.({ error: 'no-speech' }));
    expect(result.current.error).not.toBeNull();

    act(() => instances[0].onend?.());
    act(() => result.current.start());

    expect(result.current.error).toBeNull();
  });
});
