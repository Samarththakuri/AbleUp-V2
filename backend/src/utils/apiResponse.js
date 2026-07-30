/**
 * Shared response helpers.
 *
 * These deliberately preserve the shapes the existing controllers and the
 * frontend already rely on:
 *   success -> { success: true, ...payload }
 *   error   -> { success: false, message, code? }
 * The frontend's api() reads `data.message` on failure, so `message` stays
 * top-level. `code` is additive and lets the client branch on the reason
 * (e.g. RECRUITER_NOT_VERIFIED) instead of matching on message substrings.
 */
export const ok = (res, payload, status = 200) => res.status(status).json({ success: true, ...payload });

export const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

/**
 * Throwable error carrying an HTTP status. The existing global errorHandler
 * already reads `err.statusCode`, so these surface correctly without changes
 * there; `code` is picked up by the updated handler.
 */
export class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, code) {
    return new ApiError(400, message, code);
  }
  static unauthorized(message = "Unauthorized", code) {
    return new ApiError(401, message, code);
  }
  static forbidden(message = "Forbidden", code) {
    return new ApiError(403, message, code);
  }
  static notFound(message = "Not found", code) {
    return new ApiError(404, message, code);
  }
  static conflict(message, code) {
    return new ApiError(409, message, code);
  }
}
