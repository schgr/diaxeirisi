'use strict';

const { displayVersion } = require('../../package.json');

const CHANNELS = Object.freeze([
  "app:get-version",
  "app:get-runtime-info",
  "auth:status",
  "auth:setup",
  "auth:login",
  "auth:change-password",
  "auth:change-credentials",
  "auth:create-recovery-code",
  "auth:change-security-questions",
  "auth:answer-security-questions",
  "auth:recover",
  "auth:lock"
]);

function registerAuthHandlers({
  register,
  safeInvoke,
  app,
  offlineOnly,
  isWindows7Legacy,
  securityService
}) {
  register('app:get-version', async () => safeInvoke(() => displayVersion || app.getVersion(), true));
  register('app:get-runtime-info', async () => safeInvoke(() => ({
      version: displayVersion || app.getVersion(),
      buildFlavor: isWindows7Legacy ? 'win7-legacy' : 'standard',
      offlineOnly,
      electronVersion: process.versions.electron
    }), true));
  register('auth:status', async () => safeInvoke(() => securityService.status(), true));
  register('auth:setup', async (_event, username, password, confirmation, securityQuestions) =>
      safeInvoke(() => securityService.setup(username, password, confirmation, securityQuestions), true)
    );
  register('auth:login', async (_event, username, password) =>
      safeInvoke(() => securityService.login(username, password), true)
    );
  register('auth:change-password', async (_event, currentPassword, newPassword, confirmation) =>
      safeInvoke(() => securityService.changePassword(currentPassword, newPassword, confirmation))
    );
  register('auth:change-credentials', async (_event, currentPassword, username, newPassword, confirmation) =>
      safeInvoke(() => securityService.changeCredentials(currentPassword, username, newPassword, confirmation))
    );
  register('auth:create-recovery-code', async () =>
      safeInvoke(() => securityService.createRecoveryCode())
    );
  register('auth:change-security-questions', async (_event, currentPassword, questions) =>
      safeInvoke(() => securityService.changeSecurityQuestions(currentPassword, questions))
    );
  register('auth:answer-security-questions', async (_event, answers) =>
      safeInvoke(() => securityService.answerSecurityQuestions(answers), true)
    );
  register('auth:recover', async (_event, recoveryCode, username, newPassword, confirmation) =>
      safeInvoke(() => securityService.recover(recoveryCode, username, newPassword, confirmation), true)
    );
  register('auth:lock', async () => safeInvoke(() => securityService.lock()));
}

module.exports = {
  CHANNELS,
  registerAuthHandlers
};
