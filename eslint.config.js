// ADR 0113 and ADR 0115: `npm run lint:hooks` runs only the two React hooks
// rules over src/ and api/ with `--max-warnings 0`, so a warning fails it, and
// `npm run lint` runs it last, so CI fails on one too.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    // Three older sites carry a bare `// eslint-disable-next-line`; leave them be.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
