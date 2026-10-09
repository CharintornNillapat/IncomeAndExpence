import { configure } from '@testing-library/dom';

// Phase 120 (ADR 0096): a `findBy*` or `waitFor` bounds a failure, never the
// time a step may take (ADR 0083). Testing Library's 1 s default was a ceiling
// that the full suite's load crossed in the shuffled runs (the sessions list in
// `authenticated-ledger`); 3 s stays under Vitest's 5 s test limit, so a real
// failure still names the wait. A passing wait returns as soon as it holds.
configure({ asyncUtilTimeout: 3000 });
