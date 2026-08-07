const { createLogger } = require('./logger');

const logger = createLogger('safeJson');

// Stored JSON columns are written by the application itself, so malformed data
// means corruption: fall back to a safe value but never fail silently.
function parseStoredJson(value, fallback, context) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    logger.warn(`Malformed stored JSON (${context}); the default value is used instead.`, {
      message: error && error.message
    });
    return fallback;
  }
}

function parseStoredJsonArray(value, context) {
  const parsed = parseStoredJson(value, [], context);
  if (Array.isArray(parsed)) return parsed;
  logger.warn(`Stored JSON (${context}) is not a list; an empty list is used instead.`);
  return [];
}

module.exports = {
  parseStoredJson,
  parseStoredJsonArray
};
