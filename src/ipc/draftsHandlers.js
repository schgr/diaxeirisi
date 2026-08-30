'use strict';

const CHANNELS = Object.freeze([
  'drafts:get',
  'drafts:save',
  'drafts:clear'
]);

function registerDraftsHandlers({
  register,
  safeInvoke,
  draftsService
}) {
  register('drafts:get', async (_event, payload) =>
      safeInvoke(() => draftsService.getDraft(payload.key))
    );
  register('drafts:save', async (_event, payload) =>
      safeInvoke(() => draftsService.saveDraft(payload.key, payload.data))
    );
  register('drafts:clear', async (_event, payload) =>
      safeInvoke(() => draftsService.clearDraft(payload.key))
    );
}

module.exports = {
  CHANNELS,
  registerDraftsHandlers
};
