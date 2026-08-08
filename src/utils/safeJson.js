function safeJsonParse(value, fallback, context) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Μη έγκυρο JSON${context ? ` (${context})` : ''} — χρήση προεπιλογής.`, error);
    return fallback;
  }
}

module.exports = { safeJsonParse };
