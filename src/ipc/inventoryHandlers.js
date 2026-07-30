'use strict';

const CHANNELS = Object.freeze([
  "inventory:reference-data",
  "inventory:create-session",
  "inventory:get-session",
  "inventory:save-count",
  "inventory:save-committee",
  "inventory:complete-session",
  "inventory:differences",
  "inventory:settle-difference",
  "year-end:renumbering-data",
  "year-end:status",
  "year-end:validate-renumbering",
  "year-end:apply-renumbering",
  "year-end:close",
  "movement-differences:reference-data",
  "movement-differences:create",
  "movement-differences:list",
  "movement-differences:get",
  "movement-differences:response",
  "movement-differences:settle",
  "movement-differences:escalate"
]);

function registerInventoryHandlers({
  register,
  safeInvoke,
  services
}) {
  register('inventory:reference-data', async (_event, asOfDate) =>
      safeInvoke(() => services.inventory.getReferenceData(asOfDate))
    );
  register('inventory:create-session', async (_event, payload) =>
      safeInvoke(() => services.inventory.createSession(payload))
    );
  register('inventory:get-session', async (_event, id) =>
      safeInvoke(() => services.inventory.getSession(id))
    );
  register('inventory:save-count', async (_event, payload) =>
      safeInvoke(() => services.inventory.saveCount(payload))
    );
  register('inventory:save-committee', async (_event, id, payload) =>
      safeInvoke(() => services.inventory.saveCommittee(id, payload))
    );
  register('inventory:complete-session', async (_event, id) =>
      safeInvoke(() => services.inventory.completeSession(id))
    );
  register('inventory:differences', async () =>
      safeInvoke(() => services.inventory.listDifferences())
    );
  register('inventory:settle-difference', async (_event, id, reference) =>
      safeInvoke(() => services.inventory.settleDifference(id, reference))
    );
  register('year-end:renumbering-data', async () =>
      safeInvoke(() => services.yearEnd.getRenumberingData())
    );
  register('year-end:status', async () =>
      safeInvoke(() => services.yearEnd.getStatus())
    );
  register('year-end:validate-renumbering', async (_event, payload) =>
      safeInvoke(() => services.yearEnd.validateRenumbering(payload))
    );
  register('year-end:apply-renumbering', async (_event, payload) =>
      safeInvoke(() => services.yearEnd.applyRenumbering(payload))
    );
  register('year-end:close', async (_event, year) =>
      safeInvoke(() => services.yearEnd.closeFiscalYear(year))
    );
  register('movement-differences:reference-data', async () =>
      safeInvoke(() => services.movementDifferences.getReferenceData())
    );
  register('movement-differences:create', async (_event, payload) =>
      safeInvoke(() => services.movementDifferences.createProtocol(payload))
    );
  register('movement-differences:list', async (_event, year) =>
      safeInvoke(() => services.movementDifferences.listProtocols(year))
    );
  register('movement-differences:get', async (_event, id) =>
      safeInvoke(() => services.movementDifferences.getProtocol(id))
    );
  register('movement-differences:response', async (_event, id, payload) =>
      safeInvoke(() => services.movementDifferences.recordResponse(id, payload))
    );
  register('movement-differences:settle', async (_event, id, payload) =>
      safeInvoke(() => services.movementDifferences.settleProtocol(id, payload))
    );
  register('movement-differences:escalate', async (_event, id, date) =>
      safeInvoke(() => services.movementDifferences.escalateProtocol(id, date))
    );
}

module.exports = {
  CHANNELS,
  registerInventoryHandlers
};
