'use strict';

const CHANNELS = Object.freeze([
  "administration:reference-data",
  "administration:management-report",
  "administration:balance-differences",
  "administration:add-officer",
  "administration:close-officer",
  "administration:create-handover",
  "administration:get-handover",
  "administration:update-handover-check",
  "administration:update-handover-protocol",
  "administration:complete-handover",
  "administration:archive-share",
  "administration:restore-share",
  "annual-accounts:get",
  "annual-accounts:update",
  "annual-accounts:update-check",
  "annual-accounts:submit"
]);

function registerAdministrationHandlers({
  register,
  safeInvoke,
  services
}) {
  register('administration:reference-data', async () =>
      safeInvoke(() => services.administration.getReferenceData())
    );
  register('administration:management-report', async (_event, year) =>
      safeInvoke(() => services.administration.getManagementReport(year))
    );
  register('administration:balance-differences', async () =>
      safeInvoke(() => services.administration.getBalanceDifferences())
    );
  register('administration:add-officer', async (_event, payload) =>
      safeInvoke(() => services.administration.addOfficerTerm(payload))
    );
  register('administration:close-officer', async (_event, id, endDate) =>
      safeInvoke(() => services.administration.closeOfficerTerm(id, endDate))
    );
  register('administration:create-handover', async (_event, payload) =>
      safeInvoke(() => services.administration.createHandover(payload))
    );
  register('administration:get-handover', async (_event, id) =>
      safeInvoke(() => services.administration.getHandover(id))
    );
  register('administration:update-handover-check', async (_event, id, payload) =>
      safeInvoke(() => services.administration.updateHandoverCheck(id, payload))
    );
  register('administration:update-handover-protocol', async (_event, id, payload) =>
      safeInvoke(() => services.administration.updateHandoverProtocol(id, payload))
    );
  register('administration:complete-handover', async (_event, id, payload) =>
      safeInvoke(() => services.administration.completeHandover(id, payload))
    );
  register('administration:archive-share', async (_event, payload) =>
      safeInvoke(() => services.administration.archiveShare(payload))
    );
  register('administration:restore-share', async (_event, id, actionDate) =>
      safeInvoke(() => services.administration.restoreShare(id, actionDate))
    );
  register('annual-accounts:get', async (_event, year) =>
      safeInvoke(() => services.annualAccounts.getPackage(year))
    );
  register('annual-accounts:update', async (_event, id, payload) =>
      safeInvoke(() => services.annualAccounts.updatePackage(id, payload))
    );
  register('annual-accounts:update-check', async (_event, id, key, payload) =>
      safeInvoke(() => services.annualAccounts.updateCheck(id, key, payload))
    );
  register('annual-accounts:submit', async (_event, id, date) =>
      safeInvoke(() => services.annualAccounts.submitPackage(id, date))
    );
}

module.exports = {
  CHANNELS,
  registerAdministrationHandlers
};
