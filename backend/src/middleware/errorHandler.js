import { ZodError } from "zod";
import { env } from "../config/env.js";
import logger from "../utils/logger.js";

export const errorHandler = (
  err,
  req,
  res,
  next
) => {
  // Zod errors that escape the validate() middleware (e.g. thrown from a
  // service) are client errors, not 500s.
  if (err instanceof ZodError || err?.name === "ZodError") {
    res.status(400).json({
      success: false,
      message: "Validation error",
      code: "VALIDATION_ERROR",
      errors: err.errors,
    });
    return;
  }

  /**
   * Mongoose schema validation -> 400.
   *
   * The schemas carry real constraints now (enums on the disability and
   * accessibility vocabularies, length bounds, salary range, rating bounds), so
   * a bad value that slips past the Zod DTO — an unvalidated route, a service
   * writing directly — arrives here. Without this it was a 500 for what is
   * plainly a client error.
   */
  if (err?.name === "ValidationError" && err?.errors) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      code: "VALIDATION_ERROR",
      // Same { path, message } shape the validate() middleware emits, so the
      // client has one error format regardless of which layer rejected.
      errors: Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
    return;
  }

  // A malformed ObjectId in a path param or filter is a client error too.
  if (err?.name === "CastError") {
    res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}`,
      code: "INVALID_ID",
    });
    return;
  }

  // Mongoose duplicate key -> 409 rather than a generic 500.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
      code: "DUPLICATE_KEY",
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Only log genuine server faults; expected 4xx flow-control errors are noise.
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`, {
      // A string, not the Error itself. Error's own properties are
      // non-enumerable, so passing `err` here serialises to {} in the JSON log
      // — the one place the stack was actually needed.
      stack: err.stack,
      code: err.code,
      userId: req.user?._id?.toString(),
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.code && typeof err.code === "string" ? { code: err.code } : {}),
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
