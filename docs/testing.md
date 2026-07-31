# Test execution

`npm test` first runs the structural repository checks and then discovers every
`*.test.js` and `*.test.mjs` file below `tests/`. Test files run sequentially in
deterministic path order, each in a separate Node.js process.

Build, release, dependency, coverage and temporary directories are excluded.
Device copies (`-TECLAST`, `-Movies`) and backup-file suffixes are also excluded.
Adding a conforming test file requires no `package.json` change.
