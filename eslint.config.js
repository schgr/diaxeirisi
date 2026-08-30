const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/data/**',
  '**/release/**',
  '**/dist/**',
  '**/docs/**',
  '**/build/**',
  '**/*.min.js'
];

module.exports = [
  {
    ignores: IGNORE_PATTERNS
  },
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.{js,mjs}', 'benchmarks/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {}
  }
];
