//the frontend already reads the data.message from the error hence this was done in fail wrapper
export const ok = (res, payload, status = 200) =>
  res.status(status).json({ success: true, ...payload });

export const fail = (res, status, message, code) =>
  res
    .status(status)
    .json({ success: false, message, ...(code ? { code } : {}) });
//also codes are not needed in every place so no need to add codes in fails
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
