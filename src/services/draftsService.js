const fs = require('fs');
const path = require('path');

function createDraftsService(userDataPath) {
  const draftsPath = path.join(userDataPath, 'drafts.json');

  function readAll() {
    try {
      const raw = fs.readFileSync(draftsPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }

  function writeAll(drafts) {
    fs.mkdirSync(userDataPath, { recursive: true });
    const tmpPath = `${draftsPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(drafts, null, 2), 'utf8');
    fs.renameSync(tmpPath, draftsPath);
  }

  return {
    getDraft(key) {
      const drafts = readAll();
      return drafts[key] || null;
    },
    saveDraft(key, data) {
      const drafts = readAll();
      drafts[key] = { data, updatedAt: new Date().toISOString() };
      writeAll(drafts);
      return drafts[key];
    },
    clearDraft(key) {
      const drafts = readAll();
      if (key in drafts) {
        delete drafts[key];
        writeAll(drafts);
      }
    }
  };
}

module.exports = { createDraftsService };
