class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

function toAppError(error) {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    };
  }

  const code = typeof error?.code === 'string' && SAFE_CODE_PATTERN.test(error.code)
    ? error.code
    : 'UNEXPECTED_ERROR';

  return {
    message: 'Παρουσιάστηκε απρόβλεπτο σφάλμα.',
    code,
    details: null
  };
}

module.exports = {
  AppError,
  toAppError
};
