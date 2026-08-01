class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
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
    code: 'UNEXPECTED_ERROR',
    details: null
  };
}

module.exports = {
  AppError,
  toAppError
};
