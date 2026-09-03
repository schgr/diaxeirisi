import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFor = (files) => files
  .map((file) => path.join(root, file))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const names = (source) => [...source.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)/gmu)]
  .map((match) => match[1]);

const settings = sourceFor(['src/ui/pages/settingsPage.js', 'src/ui/pages/settings/settingsPage.js']);
const administration = sourceFor(['src/ui/pages/administrationPage.js', 'src/ui/pages/administration/administrationPage.js']);

assert.deepEqual(names(settings), [
  'renderSettingsPage', 'renderAppInformation', 'renderMaterialCardFlags', 'renderInitialInventorySection',
  'renderCompositionImportSection', 'renderClothingItemsSection', 'clothingCategoryLabel', 'bindSettingsTabs',
  'bindSettingsSubtabs', 'loadMaterialCardSettings', 'renderRequestPriorityTable', 'renderMeasurementUnitTable',
  'renderRequestCodeTable', 'renderDepartmentManagerTable', 'renderNamedList', 'renderExhpIssueReasonSettings',
  'syncExhpIssueReasonSettings', 'bindSettingsEvents', 'bindMaterialCardFlagEvents', 'bindInitialInventoryEvents',
  'bindCompositionImportEvents', 'formatBackupDate', 'bindClothingSettings', 'clothingItemUpdatePayload',
  'bindDeletes', 'bindRequestSettings', 'bindTransactionSettings', 'bindAutosaveForm', 'bindForm', 'debounce',
  'refresh', 'refreshMovedSettings'
]);
assert.deepEqual(names(administration), [
  'renderAdministrationPage', 'renderBooksRegistryBackButton', 'renderManagementReport',
  'renderSerialNumberRegistry', 'renderAmmunitionBatchRegistry', 'renderAmmunitionBatchRow',
  'renderTrainingAmmunitionBatchRegistry', 'renderTrainingAmmunitionBatchRow', 'renderHandoverPanel',
  'renderHandoverWorkspace', 'renderHandoverProtocolForm', 'protocolField', 'protocolTextarea',
  'renderArchivePanel', 'setSerialRegistryEditing', 'collectSerialRegistryPreviewRows',
  'renderSerialRegistryPreviewPage', 'openSerialRegistryPreview', 'printSerialRegistryPreview',
  'bindAdministrationPage', 'openHandoverProtocolDocument', 'printHandoverDocument', 'collectHandoverProtocol',
  'renderOfficerIdentity', 'printArchivedSharesTable', 'openArchivedSharesPreview', 'renderArchivedSharesDocument',
  'printAmmunitionBatchTable',
  'openAmmunitionBatchPreview', 'printAmmunitionBatchPreview', 'run', 'value', 'formatDate', 'formatQuantity'
]);

const settingsApi = await import('../src/ui/pages/settingsPage.js');
const administrationApi = await import('../src/ui/pages/administrationPage.js');
assert.deepEqual(Object.keys(settingsApi).sort(), [
  'bindRequestSettings', 'bindTransactionSettings', 'renderAppInformation', 'renderCompositionImportSection',
  'renderExhpIssueReasonSettings', 'renderInitialInventorySection', 'renderMeasurementUnitTable',
  'renderNamedList', 'renderRequestCodeTable', 'renderRequestPriorityTable', 'renderSettingsPage',
  'syncExhpIssueReasonSettings'
]);
assert.deepEqual(Object.keys(administrationApi).sort(), [
  'openArchivedSharesPreview', 'printArchivedSharesTable', 'renderAdministrationPage', 'renderArchivePanel',
  'renderManagementReport'
]);
console.log('Settings/Administration function and public API parity passed.');
