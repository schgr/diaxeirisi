const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

function safeCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  return SAFE_CODE_PATTERN.test(code) ? code : 'UNEXPECTED_ERROR';
}

function toAppError(error) {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    };
  }

  return {
    message: 'Παρουσιάστηκε απρόβλεπτο σφάλμα.',
    code: safeCode(error),
    details: null
  };
}

module.exports = {
  AppError,
  toAppError
};
