# Baseline Audit και Σταδιακό Refactor Plan

Ημερομηνία audit: 29 Αυγούστου 2026  
Project: `diaxeirisi-ylikoy`  
Audit scope: package/dependencies, Electron/build, main/preload/UI, IPC, services,
repositories, workers, database/persistence, migrations, security, validation,
tests και τα ζητημένα hotspots.

## 1. Κανόνες και μεθοδολογία

- Το audit έγινε πάνω στο τρέχον working tree, το οποίο ήταν ήδη έντονα dirty.
- Δεν τροποποιήθηκε source code, test, configuration, dependency ή lockfile στο πλαίσιο αυτού του audit.
- Το παρόν αρχείο είναι η μόνη νέα εγγραφή του audit.
- Τα ήδη υπάρχοντα local changes θεωρήθηκαν ιδιοκτησία του χρήστη και δεν έγινε revert ή cleanup.
- Οι μετρήσεις LOC είναι φυσικές γραμμές αρχείου. Ο αριθμός functions μετρά named function declarations,
  named arrow functions και object methods· δεν μετρά κάθε anonymous event callback.
- Η ένδειξη «unused export» είναι αποτέλεσμα static analysis και όχι απόδειξη dead code. Dynamic/test access,
  public compatibility ή χρήση από source-text tests μπορεί να μην ανιχνεύεται.
- Δεν εκτελέστηκε build ή installer generation, επειδή θα δημιουργούσε/αντικαθιστούσε generated artifacts.

## 2. Executive baseline

| Πεδίο | Baseline |
|---|---|
| Production/test modules | 163 modules, 160 reachable, 0 orphans |
| Circular dependencies | 0 |
| Byte-identical source modules/assets | 0 |
| IPC | 173 unique catalogued channels, handler parity test passing |
| Tests | 72 test files, 8.308 LOC, 72/72 passing |
| Migrations | 70 ordered migrations, 1–61 hash-protected, 62–70 parity-tested |
| Electron | Installed/locked 42.9.3; compatible 42.10.1 exists |
| Legacy Electron | Windows 7 profiles pin 22.3.27 intentionally |
| ExcelJS / UUID | ExcelJS 4.4.0; one UUID installation, 11.1.1; no nested UUID 8.x |
| `npm ls --all` | Clean, no reported dependency-tree problems |
| `npm audit` | Runs; full tree: 30 advisories (1 critical, 25 high, 4 moderate) |
| `npm audit --omit=dev` | 0 advisories, but see dependency-audit caveat below |
| Static checks | Passing |
| Performance benchmark | Failing twice, for two different limits |

Overall architecture is already layered (`UI -> preload/IPC -> services -> repositories -> sql.js`),
with strong migration, persistence, IPC and regression safeguards. The principal maintainability risk is
concentration of UI/document/workflow logic in a small number of very large modules. The principal immediate
reliability risks are packaging reproducibility, dependency/toolchain advisories and a non-green performance baseline.

## 3. Confirmed findings

### F-01 — HIGH — Installer include is ignored and untracked

- Files/lines: `.gitignore:5`; `package.json:72`; `electron-builder.win-x86.json:38`;
  `electron-builder.win7.json:44`; `electron-builder.win7-x86.json:44`.
- Cause: every NSIS configuration references `build/installer.nsh`, but `.gitignore` excludes the entire
  `build/` directory. Only `build/icon.ico` is already tracked; `build/installer.nsh` is present locally but untracked.
- Impact: a fresh clone/CI build cannot reproduce the current installers and may fail because the configured
  include is absent. The custom uninstall/data-retention semantics are therefore not reproducible from Git.
- Proposed correction: explicitly unignore and track only `build/installer.nsh`, without changing its contents.
- Proof test: clean-clone `npm ci`, then build x64, x86 and both legacy profiles; verify the NSIS include is found
  and the uninstall confirmation/keep-data path remains present.

### F-02 — HIGH — Dependency/toolchain audit is not green

- Files/lines: `package.json:77-93`, relevant resolved nodes in `package-lock.json`.
- Cause: the full installed tree includes advisories through Electron download tooling, electron-builder 26.8.1,
  `app-builder-lib`, `tar`, `undici`, `js-yaml`, `glob/minimatch/brace-expansion`, and ExcelJS transitive
  `archiver/unzipper` chains.
- Impact: build/supply-chain exposure is confirmed; some advisories concern parsing/DoS and archive tooling.
  The application is offline-hardened, which reduces exposure for Electron networking advisories but does not
  remove build-time or untrusted-XLSX/archive risks.
- Evidence: full `npm audit --json` reports 30 vulnerable packages: 1 critical, 25 high, 4 moderate.
  `npm audit --omit=dev` reports zero, despite the full report associating ExcelJS with archiver/unzipper;
  this discrepancy must be treated conservatively rather than used to dismiss the full result.
- Proposed correction: upgrade in an isolated dependency-only change. First test Electron 42.10.1 and
  electron-builder 26.15.3; then evaluate safe overrides or a supported ExcelJS replacement/version without
  changing spreadsheet formats. Never run `npm audit fix --force` automatically.
- Proof test: `npm ci`, `npm ls --all`, both audit modes, all 72 tests, Excel import/export tests, all installers,
  and signed/unsigned artifact smoke tests as applicable.

### F-03 — MEDIUM — Performance baseline is not currently repeatable/green

- File/lines: `benchmarks/performanceBenchmark.mjs:28`, `:32`, `:353`, `:359`.
- Cause: the first standard run exceeded the 500 ms renderer-stall limit; an immediate second standard run
  exceeded the 10.000 ms backup limit. The benchmark stops at the first failing assertion and does not persist
  the full report before assertion failure.
- Impact: refactors cannot currently use the benchmark as a reliable regression gate. The two different failures
  indicate either environmental variance or more than one performance pressure point; no business behavior failed.
- Proposed correction: first collect repeated baseline runs on a controlled machine and record raw metrics before
  assertions. Do not relax limits without documented evidence.
- Proof test: at least 5 identical runs, with raw per-operation/stall metrics retained; investigate any repeatable breach.

### F-04 — LOW — Overridden duplicate repository method

- File/lines: `src/db/transactionsRepository.js:142` and `:391`.
- Cause: `createTransactionsRepository()` defines `adjustChargedQuantity` twice in the same returned object.
  The later definition overrides the earlier one. Both currently perform the same SQL update.
- Impact: the first definition is unreachable and creates maintenance ambiguity; future edits could silently diverge.
- Proposed correction: after a repository API characterization test, remove only the overridden duplicate definition.
- Proof test: assert the repository method name set and charged-quantity effects for internal, ADDY and EXHP workflows.

### F-05 — MEDIUM — Direct functional coverage gap in the largest EXHP document modules

- Files: `src/ui/transactions/exhpSupportDocuments.js`, `src/ui/transactions/exhpOfficialDocuments.js`.
- Cause: current tests cover related module bridges, prints, styles and end-to-end flow fragments, but there is no
  direct test importing either module and exercising its primary exported form/save/preview functions.
- Impact: extraction in these modules has elevated document-format and workflow regression risk.
- Proposed correction: add characterization tests for representative form codes, material tables, data collection,
  API payloads, preview HTML and print options before moving any function.
- Proof test: exact/semantic fixtures for every official document family currently rendered by these two modules.

## 4. Dependencies, Electron and packaging

### `package.json`

- `main` is `src/main.js`; package is private.
- Scripts cover start, syntax check, automatic test discovery, six benchmark variants and five Windows builds.
- Runtime dependencies: ExcelJS `^4.4.0`, sql.js `^1.12.0`, UUID `^11.1.1`.
- Dev dependencies: Electron `^42.9.3`, electron-builder `^26.0.12`.
- Overrides force `tmp >=0.2.6`, `readable-stream 3.6.2`, the lazystream compatibility dependency,
  and ExcelJS UUID to `^11.1.1`.
- Version fields are internally consistent: package `1.0.3+04`, display `1.0.3.04`, build `1.0.3.4`.

### `package-lock.json`

- Lockfile version 3; installed tree matches it (`npm ls --all` reports no problems).
- Resolved versions: Electron 42.9.3, electron-builder 26.8.1, ExcelJS 4.4.0, sql.js 1.14.1, UUID 11.1.1.
- ExcelJS metadata still declares `uuid ^8.3.0`, but the override dedupes it to the sole installed UUID 11.1.1.
  There is no nested UUID 8.x in either lockfile package paths or `npm ls` output.
- The existing Excel import/export tests pass with UUID 11.1.1, so the current override is a working safe solution.

### Electron versions

- The installed and locked primary Electron is exactly 42.9.3, so it meets the requested minimum.
- The x86 Windows 10/11 profile explicitly pins 42.9.3.
- Electron 42.10.1 is a newer compatible release in the same major line and should be evaluated separately:
  [Electron releases](https://releases.electronjs.org/release).
- The two Windows 7 legacy profiles intentionally pin Electron 22.3.27. Therefore, the statement “all builds use
  Electron 42.9.3+” is false. Updating those profiles cannot be treated as a patch refactor because it may end
  Windows 7 compatibility. Keep this as an explicitly accepted, offline-only legacy risk or retire the builds by decision.

### Build and packaging

- Primary package uses ASAR, NSIS, x64+ia32 targets, icon, custom installer include and explicit artifact naming.
- Separate x86 and Windows 7 x64/x86 configurations are present; beta config inherits the main build.
- `npmRebuild: false` is explicit in alternate profiles. Current runtime dependencies are JavaScript/WASM rather than
  native Node addons, so this is presently consistent.
- Existing `app.asar` inspection confirms inclusion of `src/main.js`, `src/preload.js`, heavy/backup workers,
  `sql.js/dist/sql-wasm.wasm` and all 42 official-form PNG assets.
- The four build profiles consistently exclude `src/types/**/*`, `docHeader.js`, `letteredList.js` and codex backup files.
- Packaging remains non-reproducible until F-01 is resolved.

### `docHeader.js` and `letteredList.js` exclusions

- Confirmed production imports/callers: none.
- Confirmed dynamic imports: only `tests/exhpFormShared.test.js` imports `docHeader.js`; only
  `tests/docIAPyromaxika.test.js` imports `letteredList.js`.
- The orphan checker explicitly lists both as intentional test-only modules.
- Neither file appears in the inspected production ASAR, and all 72 tests pass from source.
- Conclusion: the exclusions are safe for the current production graph.
- Required guard: add a packaging-graph test that fails if any production module begins importing either excluded file.

## 5. Architecture audit

### Main process

- `src/main.js` is 335 LOC and remains a composition root plus lifecycle coordinator.
- It constructs services, security, backups, workers and database; registers IPC; creates the BrowserWindow;
  starts automatic/scheduled backups; and coordinates safe shutdown.
- Side effects are explicit at startup (`applyOfflineCommandLine`, process error handlers, session policy,
  database initialization, backup interval).
- Refactor direction: retain it as composition root; extract only stable startup phases after adding lifecycle tests.

### Preload and IPC

- `src/preload.js` is 296 LOC and exposes a large but explicit `appApi` surface through `contextBridge`.
- All calls use `ipcRenderer.invoke` through a normalized `{ok,data}` / `{ok:false,error}` envelope.
- IPC has 14 modules/1.420 LOC, a central 173-channel catalog, duplicate-registration protection,
  sender/main-frame validation, argument depth/size/type checks and path validation.
- The large preload surface is maintainability risk, not currently a security breach. Preserve channel names and object shapes.

### UI

- 46 JavaScript modules, 18.253 LOC.
- Renderer is ESM and isolated from Node. Pages/modules perform rendering, event binding, payload collection,
  previews and print orchestration.
- Several hotspot files mix coordinator, presentation, data mapping, validation and domain decisions.
- Refactor only after characterization tests; prefer cohesive feature modules, not one-function micro-modules.

### Services

- 26 modules, 6.254 LOC.
- Services generally own validation, business rules, transaction boundaries and repository orchestration.
- Transactions already use a submodule pattern (`addyService`, `exhpService`, query/index/shared), which is the model
  to follow elsewhere.
- `sharesService` remains too broad and contains several separable registries/print-card responsibilities.

### Repositories

- Repository layer consistently wraps sql.js prepared statements and transaction helpers.
- `transactionsRepository` and `sharesRepository` are oversized, broad APIs with repeated share/composition queries.
- Dynamic table names in `transactionsRepository` are allowlisted before interpolation.
- Keep SQL, method names, return rows and transaction boundaries unchanged during extraction.

### Workers

- 4 modules, 1.175 LOC.
- Heavy-task runner provides a worker pool, task IDs, timeouts, cancellation, progress, transfer lists,
  resource serialization and worker replacement after failure.
- Backup worker validates paths/symlinks, manifest hashes, database integrity/schema, free space and rollback state.
- Worker/backup semantics are high-risk and should be refactored late.

### Database and persistence

- sql.js database is integrity-checked before opening; valid `.bak` recovery requires explicit user acceptance.
- Foreign keys are enabled; mutating SQL marks state dirty; persistence is debounced with max delay.
- Nested transactions use savepoints; async transaction callbacks are explicitly rejected.
- Atomic persistence rotates staged/main/backup files and contains rollback paths.
- Shutdown flushes before close; backup creation requests a flushed/exported snapshot.
- Existing persistence and backup tests are substantial and passing.

### Migrations

- 70 unique, ordered migrations; only migration 66 requires temporary foreign-key disablement.
- Runner compares foreign-key violations before/after that migration and rejects new violations.
- Test suite freezes hashes for published migrations 1–61 and verifies fresh, upgrade and idempotent parity through 70.
- Do not edit published migration SQL. New schema changes require new migrations and separate authorization.

### Security

- BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, devtools restricted to beta builds.
- CSP blocks network connections, frames, objects, external form actions and non-self scripts.
- Offline policy blocks HTTP(S), WS(S), arbitrary data/blob URLs, downloads, permissions, webviews, new windows,
  remote navigation and redirects.
- IPC validates sender URL/frame, structured argument bounds/types and path roots.
- Authentication uses scrypt, random salts, timing-safe comparison, progressive lockouts, recovery-code hashing,
  security-question hashing and atomic config writes.
- Residual risk: Windows 7/Electron 22 legacy support and dependency/toolchain advisories.

### Validation

- 11 dedicated validation modules plus service-local validation.
- Domain validation is mostly in services/domain modules rather than repositories.
- UI still performs workflow validation for official documents and balance/allocation decisions; those rules must be
  characterized before extraction to avoid accidental semantic changes.

### Tests

- 48 CommonJS `.test.js` and 24 ESM `.test.mjs` files; 8.308 LOC total.
- Automatic discovery runs each test in a separate process and runs orphan checks first.
- Strengths: database/atomic persistence, migrations, backup/security, service integrations, IPC parity,
  print parity, source/module parity and representative UI regressions.
- Limitations: no line/branch coverage instrumentation; several UI tests inspect source strings/regex rather than behavior;
  the two largest EXHP document modules lack direct functional tests; standard benchmark is not green.

## 6. Hotspot inventory

### 6.1 `src/ui/transactions/exhpSupportDocuments.js`

- LOC/functions: 1.289 / 69.
- Exports: `renderExhpSupportChecklist`, `renderSupportTemplateCards`, `openExhpSupportFolder`,
  `openExhpSupportTemplate`, `collectExhpSupports`, `captureExhpDraftSupports`,
  `createDraftSupportDocument`, manual-row helpers and `isInventorySupportTemplate`.
- Imports: `../components/forms.js`, `./shared.js`, `./exhpOfficialDocuments.js`.
- Production callers: `addyForm.js`.
- Responsibilities: support checklist/manual rows, template selection, modal lifecycle, editable material rows,
  draft capture, generic/faithful official previews, overlay coordinates and multiple official-form renderers.
- Duplicated logic: `renderExhpModalMetadata` and `formatAmmoLine` also exist in `exhpOfficialDocuments.js`;
  modal creation/data collection patterns repeat internally.
- Business logic: support classification, template action labels, document-specific field/date/material normalization,
  row pagination and form-definition selection.
- UI logic: dominant; HTML generation, DOM binding, modal state and preview rendering.
- Validation: UI-level row collection/normalization; no AppError/domain validation.
- IPC: passed transaction API calls for update/save; no direct database access.
- Side effects: DOM insertion/removal, event registration and API mutations.
- Test coverage: indirect via EXHP flow/module/print/style tests; no direct module import/behavior test.
- Proposed refactor: first add form-family characterization tests; then extract one cohesive official-template renderer/data
  definition module and a shared EXHP modal metadata formatter. Preserve export names through re-exports if needed.
- Risk: HIGH because official document formats and workflow semantics are protected contracts.

### 6.2 `src/ui/transactions/exhpOfficialDocuments.js`

- LOC/functions: 1.104 / 61.
- Exports: `USELESS_MATERIAL_FORMS`, `renderUselessMaterialTabs`, `renderUselessBForm`, `renderAmmoTable`,
  row/share binding and autofill helpers, document ensure/save/preview/modal functions, reason predicates,
  `prepareUselessProtocolData`, and `validateSharedMaterialPayload`.
- Imports: forms, `sharesPage.js`, `exhpDocuments.mjs`, transaction shared helpers.
- Production callers: `addyForm.js`, `exhpDocumentsWizard.js`, `exhpSupportDocuments.js`.
- Responsibilities: official EXHP data forms, useless-material forms, ammunition forms, persistence payloads,
  share autofill, duplicate detection, preview/print and reason-dependent routing.
- Duplicated logic: modal mode/metadata/printing and ammo formatting overlap `exhpSupportDocuments.js`.
- Business logic: reason classification, form selection, shared-material validation, normalization and document titles.
- UI logic: dominant; form rows, modals, binders, overlays, print roots.
- Validation: client-side duplicate/share/material checks; service remains authoritative for persistence.
- IPC: `exhpDocs`, shares lookup and print APIs; no database access.
- Side effects: DOM lifecycle, mutations through preload API and printing.
- Test coverage: indirect print/flow coverage; exported primary functions lack direct module tests.
- Proposed refactor: characterize payloads and output first; then separate pure reason/data mappers from modal/print
  coordinator. Consolidate shared EXHP modal/print primitives only after parity tests.
- Risk: HIGH.

### 6.3 `src/ui/transactions/addyForm.js`

- LOC/functions: 1.431 / 34 named functions (plus many anonymous handlers).
- Exports: `bindAddyForm`, `exceedsDepartmentCreditBalance`.
- Imports: both EXHP document modules, ADDY/EXHP printers, entry/shared helpers, wizard, module bridge, settings page.
- Production callers: `transactionsPage.js`.
- Responsibilities: ADDY and EXHP form coordination, draft autosave/restore, reason application, editing/deleting,
  commerce dialogs, share selection, department allocation, wizard steps and print calls.
- Duplicated logic: repeated dialog `finish`/keydown/backdrop lifecycles and focus restoration patterns.
- Business logic: tool composition charge items, reason-dependent modes, balance/allocation checks and issued-draft cleanup.
- UI logic: very high; 145+ DOM/event-operation signals and multiple modal flows.
- Validation: substantial UI pre-validation and balance checks; authoritative validation also exists in transaction services.
- IPC: broad transactions/drafts/internal API use; no direct database access.
- Side effects: timers for draft saving, DOM/event lifecycle, mutations, print/modal flows.
- Test coverage: `addyEditingUi`, `exhpCollectionFlow`, `pageDraftPersistence`, archive/reason regression plus service tests.
- Proposed refactor: keep `bindAddyForm` as coordinator; first extract cohesive dialog lifecycle utilities and pure draft-key/
  payload helpers with exact tests. Split ADDY and EXHP binding only after public workflow fixtures exist.
- Risk: CRITICAL due central user workflow and cross-module coupling.

### 6.4 `src/ui/pages/settingsPage.js`

- LOC/functions: 1.203 / 38.
- Exports: page renderer, request/transaction binders and several table/section renderers.
- Imports: forms, confirmation dialog, request priorities.
- Production callers: renderer, requests page, transactions page and `addyForm.js`.
- Responsibilities: settings tabs, service/officer/security settings, backup UI, initial inventory/composition imports,
  catalog CRUD, material flags, clothing settings and autosave.
- Duplicated logic: repeated CRUD table bind/add/delete/refresh patterns and progress-listener handling.
- Business logic: category labels, payload mapping and refresh selection; most actual rules live in services.
- UI logic: dominant.
- Validation: form-level checks and payload preparation; server-side settings/security validation exists.
- IPC: very broad settings/auth/backup/heavy-task/clothing/shares/transactions API use.
- Database access: none.
- Side effects: progress subscriptions, timers/debounce, DOM mutations and destructive-action confirmations.
- Test coverage: settings active-tab, initial inventory, training-ammunition integration; no complete settings workflow test.
- Proposed refactor: extract cohesive backup/import panel controller first, then catalog-table controller only where CRUD
  behavior is truly identical. Preserve exported renderer/binder signatures.
- Risk: HIGH because it spans security, backup and imports.

### 6.5 `src/ui/pages/administrationPage.js`

- LOC/functions: 1.099 / 33.
- Exports: `renderAdministrationPage`, `renderManagementReport`, `renderArchivePanel`,
  `printArchivedSharesTable`, `openArchivedSharesPreview`.
- Imports: forms, officer signature, handover protocol, controlled-materials module.
- Production callers: renderer and `financialYearTasksPage.js`.
- Responsibilities: management report, serial/ammunition registries, handover protocol, archives, previews and printing.
- Duplicated logic: five isolated-print-root lifecycles and repeated preview modal/backdrop logic.
- Business logic: registry row shaping, handover payload collection, archive/restore coordination and formatting.
- UI logic: dominant.
- Validation: client form collection plus one explicit thrown error; services enforce domain rules.
- IPC: administration, annual accounts, shares registries/cards and print APIs.
- Database access: none.
- Side effects: event binding, DOM modals, print roots, navigation events and mutations.
- Test coverage: administration layout, ammunition/training books, archive preview; service report/ledger tests cover backend.
- Proposed refactor: first extract a cohesive isolated-print/preview helper with exact HTML and cleanup tests; then split
  registry views from handover/archive coordinator. Keep all existing exports.
- Risk: HIGH because print formats and archive/handover workflows are protected.

### 6.6 `src/ui/transactions/exhpFormModuleBridge.js`

- LOC/functions: 741 / 47.
- Exports: reason-code constants, module capability checks, editor/collector/validator/printer/save functions,
  legacy preview adapter and three material-sync functions.
- Imports: `../../exhpForm/aitiologies.js`.
- Production callers: `addyForm.js`, `exhpDocumentsWizard.js`, `exhpPrint.js`.
- Responsibilities: compatibility bridge between new supporting-document modules and legacy EXHP payloads/UI.
- Duplicated logic: several material mappings/cloners/normalizers and per-document collectors share structure.
- Business logic: reason-code routing, legacy/new schema adaptation, primary/secondary material synchronization,
  comparison and optional numeric normalization.
- UI logic: editor rendering, DOM collection and print delegation.
- Validation: delegates to document modules and performs adapter-level normalization.
- IPC: uses supplied document APIs for creates/saves; no database access.
- Side effects: remote saves, remembered committee data and mutation of EXHP item arrays.
- Test coverage: direct `exhpFormModuleBridge.test.js`, document/print/flow tests.
- Proposed refactor: define characterization fixtures for every reason code and adapter direction; then extract one pure
  material-mapping module. Do not alter legacy payload shapes or reason-code sets.
- Risk: CRITICAL because it is explicitly a compatibility boundary.

### 6.7 `src/db/transactionsRepository.js`

- LOC/functions: 1.197 / 77 methods/functions.
- Exports: `createTransactionsRepository`.
- Imports: `shareQueries`, core validation and error handler.
- Production callers: `services/transactions/index.js`.
- Responsibilities: internal, ADDY and EXHP SQL persistence/querying, supports/forms, indexes, assignments,
  compositions, share transfers and transaction rollback/update.
- Duplicated logic: duplicate `adjustChargedQuantity`; share/composition queries overlap `sharesRepository`;
  repeated document/item CRUD shapes.
- Business logic: some persistence decisions, next-number selection, transfer/rollback behavior and dynamic table updates.
- UI logic: none.
- Validation: allowed-table assertion, ID filtering and selected repository-level existence/error checks.
- IPC: none.
- Database access: direct and extensive; transactions and interpolated allowlisted table identifiers.
- Side effects: all core transaction database mutations.
- Test coverage: ADDY commerce, EXHP registry gap, transaction service module parity, ledger/inventory integrations.
- Proposed refactor: first remove only the proven overridden duplicate after characterization. Later split internal,
  ADDY and EXHP repository implementations behind the unchanged facade returned by `createTransactionsRepository`.
- Risk: CRITICAL.

### 6.8 `src/db/sharesRepository.js`

- LOC/functions: 800 / 42 methods/functions.
- Exports: `createSharesRepository`.
- Imports: none.
- Production callers: `sharesService.js`.
- Responsibilities: share CRUD, print/card batch queries, yearly balances, assignments, compositions/change sheets,
  serial/ammunition/training/weapon registries and transaction helper.
- Duplicated logic: repeated registry replace transactions and overlap with transaction-repository share/composition queries.
- Business logic: mostly query ordering/aggregation and replace semantics embedded in SQL.
- UI logic: none.
- Validation: minimal; assumes service-validated inputs.
- IPC: none.
- Database access: direct and extensive.
- Side effects: share/registry/composition database mutations.
- Test coverage: shares service and many ledger/print/registry integration tests; no repository-contract test enumerating methods.
- Proposed refactor: extract registry persistence modules behind the exact same repository facade, one registry family at a
  time, with SQL/result parity tests.
- Risk: HIGH to CRITICAL.

### 6.9 `src/services/sharesService.js`

- LOC/functions: 798 / 29.
- Exports: `createSharesService`, `formatCardRegistryNumber`.
- Imports: shares repository, AppError, core validation, share mapper/validation and safe JSON parser.
- Production callers: main composition root, composition import service and year-end service.
- Responsibilities: share CRUD/cards/printing, yearly filters, compositions/change sheets and four registry families.
- Duplicated logic: ammunition and training-ammunition validation/mapping flows; registry normalization patterns.
- Business logic: extensive and appropriate to service layer—balance availability, archive/year behavior,
  registry constraints, composition and document-change construction.
- UI logic: none.
- Validation: extensive AppError-based domain validation (27 explicit AppError throws).
- IPC: indirect through shares handlers.
- Database access: only through repository.
- Side effects: repository transactions/mutations.
- Test coverage: strong—shares service, cards, registries, composition, inventory, year-end and ledger tests.
- Proposed refactor: extract cohesive registry domain helpers/services while keeping the factory’s returned method set
  unchanged. Start with pure print-card helpers, then serial/weapon registries, then ammunition flows.
- Risk: HIGH.

### 6.10 `src/workers/backupWorkerTasks.js`

- LOC/functions: 569 / 20.
- Exports: `executeBackupTask`, `validateBackup`, critical-table and manifest/database constants.
- Imports: Node crypto/fs/path/child_process and sql.js.
- Production callers: `heavyTaskWorker.js`.
- Responsibilities: backup scan/hash/manifest, database validation, incremental copy, free-space checks,
  staged restore, replacement and rollback.
- Duplicated logic: filesystem rename/copy/rollback checks repeat across prepare/apply paths, but encode different states.
- Business logic: backup compatibility, critical tables, manifest format, restore atomicity and rollback semantics.
- UI logic: none.
- Validation: strong path traversal/symlink, hash, size, schema/database integrity and space checks.
- IPC: indirect via backup service/worker protocol.
- Database access: opens backup snapshots with sql.js for integrity/schema inspection.
- Side effects: extensive filesystem operations (78 fs-operation signals), child process free-space probe and destructive
  rename/replace steps guarded by staging/rollback.
- Test coverage: strong `securityBackup.test.js` plus heavy-task tests, but real disk/AV/OneDrive variance remains.
- Proposed refactor: late-stage only. First model backup/restore states and add failure-injection tests for every filesystem
  boundary; then extract manifest validation from restore orchestration. Never change manifest or backup semantics casually.
- Risk: CRITICAL.

### 6.11 Renderer entry (`src/renderer.js` requested; actual `src/ui/renderer.js`)

- `src/renderer.js` does not exist. The production HTML loads `src/ui/renderer.js`.
- LOC/functions: 757 / 14 named functions.
- Exports: none; it is an ESM entry point.
- Imports: navigation, 11 page modules, toast/forms, document export, localized quantities and page drafts.
- Production callers: none; loaded directly by `src/ui/index.html`.
- Responsibilities: global error reporting, theme/shell, navigation/router, API wiring, page draft restoration,
  application startup, authentication gate, lock and renewal notices.
- Duplicated logic: page dispatch branches and API dependency bundles are repetitive.
- Business logic: limited but includes auth/start state and renewal-flow decisions.
- UI logic: dominant shell/router and global events.
- Validation: relies on preload/service errors; form-level auth checks.
- IPC: broad use of the exposed `window.appApi` namespaces.
- Database access: none.
- Side effects: global listeners, DOM replacement, navigation events, timers and application initialization.
- Test coverage: draft persistence, annual inventory navigation, share-print UI, auth/offline indirectly; no full renderer boot test.
- Proposed refactor: add a fake-appApi renderer boot/router characterization harness, then extract page dependency assembly
  and auth gate controller while leaving `navigate` behavior and public events unchanged.
- Risk: HIGH.

## 7. Cross-cutting checks A–J

### A. Dead code

- No orphan production modules were found.
- Confirmed unreachable member: first `adjustChargedQuantity` definition in `transactionsRepository` (F-04).
- No other deletion is authorized. All suspected dead functions/exports require caller, dynamic-reference and packaging checks.

### B. Unused exports

- Static checker reports 91 candidate exports across 27 modules: 24 known test-only and 67 unconfirmed.
- Major groups: supporting-document definitions/helpers (26), controlled-material/barcode/localized test surfaces,
  print/page render helpers, ADDY/EXHP print helpers and three bridge exports.
- These are report-only findings. Many are used internally, by dynamic tests, or retained as test/public seams.
- Before any removal: inspect direct/dynamic importers, source-text tests, ASAR graph and public compatibility; add a
  failing test proving non-use; only then request deletion approval.

### C. Duplicate modules

- No byte-identical JS/MJS/CSS/HTML files under `src`.
- No `-TECLAST` or `-Movies` source copies detected.
- Logical duplication exists in EXHP modal metadata/ammo formatting, administration print-root lifecycle,
  settings CRUD binding and duplicate repository method F-04.

### D. Circular dependencies

- 0 cycles across 163 modules in the current static local dependency graph.

### E. Dynamic imports

- No production `import()` calls and no nonliteral production `require()` calls detected.
- Dynamic imports occur only in tests, mainly to load ESM modules and the two intentional test-only shared files.

### F. Runtime file dependencies

- Packaged: main/preload/UI HTML/CSS, icon, 42 official PNGs, worker files, package metadata and sql.js WASM.
- User-data runtime files: database and `.bak`, photos, `security.json`, `drafts.json`, key-catalogue config/search file,
  backup manifests/hashes and pending-restore staging.
- External/user-selected files: Excel import/export paths and key catalogue root.
- Existing ASAR contains the required sql.js WASM and workers.

### G. Packaging exclusions

- Consistent across primary/x86/legacy profiles.
- `src/types/**/*` is non-runtime.
- `docHeader.js` and `letteredList.js` are currently test-only and safe to exclude.
- `build/installer.nsh` is not an exclusion rule but is accidentally lost from source control due to `build/` ignore (F-01).

### H. Generated artifacts

- Ignored generated directories include `release` (~2.24 GB/530 files), `build-temp` (~607 MB/9.490 files),
  two publish worktrees (~28.6 MB total), and local output/temp trees.
- Existing ASAR files are useful audit evidence but are not source of truth.
- No generated artifact should be committed except explicitly required packaging inputs such as the installer include.

### I. Temporary files

- Ignored DB-check directories contain four SQLite files totaling roughly 1.9 MB; several other DB-check dirs are empty.
- `tmp`, `tmp-electron-userdata` and `tmp-localappdata` contain local test/runtime residue (~3.6 MB total).
- No suspicious backup/device-copy files were found under tracked source.
- Cleanup should be a separate, explicit, recoverable operation; nothing was deleted during audit.

### J. Dependency vulnerabilities

- Full audit: 30 vulnerable packages (1 critical, 25 high, 4 moderate).
- Production-only audit: reports zero, with the ExcelJS caveat documented in F-02.
- Electron 42.9.3 meets the minimum but 42.10.1 is available.
- electron-builder installed 26.8.1; npm currently lists 26.15.3:
  [electron-builder on npm](https://www.npmjs.com/package/electron-builder).
- ExcelJS 4.4.0 is still the stable latest according to npm:
  [ExcelJS versions](https://www.npmjs.com/package/exceljs/v/1.0.0?activeTab=versions).
- `npm audit` is executable in the current installed/lock-consistent state. A real `npm install`/`npm ci` was not run
  during this no-mutation audit; after the next authorized clean install, both audit commands must be rerun.

## 8. Risk-ordered work plan

Every step must preserve database schema, names, IPC/preload/public APIs, error codes, object shapes,
documents, prints, workflows, authentication and backup semantics unless a separately documented bug is approved.

### Phase 0 — Baseline gates and repository hygiene (LOW risk)

1. Add a machine-readable baseline command that runs syntax, orphan/cycle checks and all tests.
2. Add packaging-graph assertions for every excluded source file and required runtime asset/worker/WASM file.
3. Add a test asserting repository/service/preload/IPC public method/channel sets.
4. Track the existing `build/installer.nsh` through a narrow `.gitignore` exception (F-01), without content changes.
5. Record repeated benchmark raw metrics before assertions; establish whether current failures are environmental.
6. Report and classify all 91 unused-export candidates; delete none in this phase.

Exit criteria: 72/72 tests, 0 orphans/cycles, all packaging graph checks pass, clean-clone packaging inputs complete,
and a documented benchmark baseline exists.

### Phase 1 — Characterization coverage (LOW to MEDIUM risk)

1. Direct tests for `exhpSupportDocuments.js` and `exhpOfficialDocuments.js` by document family.
2. Renderer boot/router/auth harness with a fake `appApi`.
3. Administration print-root cleanup and exact print-option tests.
4. Settings backup/import/catalog workflow tests.
5. Repository method-set and SQL/result-shape characterization, including both charged-quantity caller families.
6. Backup failure-injection matrix for copy/hash/rename/space/rollback boundaries.

Exit criteria: protected document HTML/payload fixtures and all existing public shapes are captured before extraction.

### Phase 2 — Mechanical cleanup and pure helpers (LOW to MEDIUM risk)

1. Remove only the overridden duplicate `adjustChargedQuantity` after its tests pass.
2. Consolidate identical pure EXHP formatters (`formatAmmoLine`, modal metadata) behind unchanged exports.
3. Extract pure renderer dependency/page-selection maps without changing navigation events.
4. Extract pure shares print-card helpers and add direct unit tests.
5. Review unused exports one by one; only remove those with complete negative evidence and explicit approval.

After each extraction: relevant tests, full test suite, syntax, imports/exports, cycles, duplicate scan and API snapshot.

### Phase 3 — UI coordinators (MEDIUM to HIGH risk)

1. Administration: shared isolated-print/preview lifecycle, then registry views.
2. Settings: backup/import panel controller, then truly generic catalog binding.
3. ADDY: reusable modal lifecycle and draft helpers; retain `bindAddyForm` as coordinator.
4. Renderer: extract auth gate and page dependency assembly after boot characterization.

No document renderer or user workflow moves until its exact/semantic fixtures are green.

### Phase 4 — Domain/service decomposition (HIGH risk)

1. Split `sharesService` internally into print-card, serial/weapon and ammunition domain collaborators.
2. Keep `createSharesService()` and its returned public method set identical.
3. Preserve AppError codes/messages and transaction boundaries.
4. Compare before/after return shapes and ordering on deterministic databases.

### Phase 5 — Repository decomposition (HIGH to CRITICAL risk)

1. Split transaction repository into internal/ADDY/EXHP implementation modules behind the same factory facade.
2. Split share registry persistence behind the same shares repository facade.
3. Do not rewrite SQL. Move exact statements first, then prove query/result parity.
4. Run fresh/upgrade migration, ledger, inventory, transaction and performance suites after every sub-extraction.

### Phase 6 — EXHP compatibility/document modules (CRITICAL risk)

1. Extract pure material mappings from `exhpFormModuleBridge` with exhaustive reason-code fixtures.
2. Separate official-document pure render/data definitions from modal/IPC coordinators.
3. Preserve every document format, overlay coordinate, field name, payload and print option.
4. Require visual/HTML parity plus end-to-end EXHP issue/edit/print tests before merging each step.

### Phase 7 — Backup/restore worker (CRITICAL risk)

1. Only after the failure-injection matrix is complete, extract manifest validation as one cohesive module.
2. Model restore phases without changing filenames, hashes, directory layout or rollback behavior.
3. Test cancellation and process termination at every filesystem boundary.
4. Perform real-device backup/restore validation on supported Windows architectures.

### Separate dependency/security track (HIGH risk, not mixed with refactors)

1. Test Electron 42.10.1 as a patch-only dependency change; keep Windows 7 profile separate.
2. Test electron-builder 26.15.3 and confirm F-01 packaging on clean checkout.
3. Re-run full and production-only audits and inspect transitive resolutions.
4. Evaluate ExcelJS archive dependencies/overrides without changing XLSX templates or exported workbooks.
5. Keep UUID 11.1.1 deduped; fail CI if any UUID 8.x node reappears.
6. Never combine dependency upgrades with architecture refactors in one logical change.

## 9. Mandatory checklist for every future extraction

Before:

1. Read target code and current diff.
2. Enumerate direct/dynamic callers, imports, exports and tests.
3. Record UI/IPC/database/filesystem/timer/global side effects.
4. Snapshot public method names, channel names, error codes and representative return shapes.
5. Identify protected document/print/business rules touched.

After:

1. Run targeted tests, then all 72+ tests.
2. Run syntax/static/orphan/cycle checks.
3. Compare imports/exports and public API snapshots.
4. Search for duplicate logic left behind.
5. Run relevant persistence/migration/security/backup/print parity tests.
6. Run the controlled performance baseline for hot paths.
7. Report any bug separately with severity, file/line, cause, impact, correction and proof test.

