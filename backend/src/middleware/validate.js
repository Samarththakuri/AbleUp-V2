/**
 * Parses `req[source]` with a Zod schema and replaces it with the parsed
 * (stripped + coerced) result, so handlers receive only whitelisted fields.
 *
 * This removes the duplicated `if (err.name === "ZodError")` try/catch blocks
 * from controllers and the hand-rolled `if (!x) res.status(400)` checks, and
 * it is what stops mass-assignment on Job.create / findByIdAndUpdate.
 */
//validate is just an higher order function here
/*function validate(schema, source = "body") {

    return function(req, res, next){

        ...

    }

}
*/
export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        code: "VALIDATION_ERROR",
        errors: result.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    // req.query/req.params are getter-only on some Express versions; assigning
    // to body is always safe and the other two are only ever read here.
    if (source === "body") {
      req.body = result.data;
    } else {
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
      });
    }

    next();
  };
