'use strict';

const CHANNELS = Object.freeze([
  "requests:reference-data",
  "requests:list",
  "requests:save",
  "requests:update-status",
  "requests:renewal-candidates",
  "requests:postpone-renewal",
  "requests:renew",
  "requests:key-catalogue-status",
  "requests:key-catalogue-choose",
  "requests:key-catalogue-search",
  "internal:reference-data",
  "internal:list",
  "internal:department-balances",
  "internal:save"
]);

function registerRequestsHandlers({
  register,
  safeInvoke,
  services,
  dialog,
  BrowserWindow,
  keyCatalogueService
}) {
  register('requests:reference-data', async () =>
      safeInvoke(() => services.requests.getReferenceData())
    );
  register('requests:list', async (_event, year) =>
      safeInvoke(() => services.requests.listRequests(year))
    );
  register('requests:save', async (_event, payload) =>
      safeInvoke(() => services.requests.saveRequest(payload))
    );
  register('requests:update-status', async (_event, id, status) =>
      safeInvoke(() => services.requests.updateStatus(id, status))
    );
  register('requests:renewal-candidates', async () =>
      safeInvoke(() => services.requests.getRenewalCandidates())
    );
  register('requests:postpone-renewal', async (_event, id) =>
      safeInvoke(() => services.requests.postponeRenewal(id))
    );
  register('requests:renew', async (_event, id, payload) =>
      safeInvoke(() => services.requests.renewRequest(id, payload))
    );
  register('requests:key-catalogue-status', async () =>
      safeInvoke(() => keyCatalogueService.status())
    );
  register('requests:key-catalogue-choose', async (event) =>
      safeInvoke(async () => {
        const owner = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(owner, {
          title: 'Επιλογή φακέλου Καταλόγου ΚΕΥ',
          properties: ['openDirectory']
        });
        if (result.canceled || !result.filePaths[0]) return { configured: false, canceled: true };
        return keyCatalogueService.configure(result.filePaths[0]);
      })
    );
  register('requests:key-catalogue-search', async (_event, query) =>
      safeInvoke(() => keyCatalogueService.search(query))
    );
  register('internal:reference-data', async () =>
      safeInvoke(() => services.internal.getReferenceData())
    );
  register('internal:list', async (_event, year) =>
      safeInvoke(() => services.internal.listMovements(year))
    );
  register('internal:department-balances', async (_event, departmentManagerId) =>
      safeInvoke(() => services.internal.listDepartmentBalances(departmentManagerId))
    );
  register('internal:save', async (_event, payload) =>
      safeInvoke(() => services.internal.saveMovement(payload))
    );
}

module.exports = {
  CHANNELS,
  registerRequestsHandlers
};
