/**
 * The one schema convention every model in this app follows.
 *
 * Before this existed each model made its own choices: only RecruiterProfile
 * used `timestamps: true` while the other six hand-rolled
 * `createdAt: { type: Date, default: Date.now }`, and Application/Interview
 * additionally declared a manual `updatedAt` whose `Date.now` *default* never
 * fired again after insert — so it silently stored a creation time unless
 * every writer remembered to set it by hand. Half of them did not.
 *
 * Spreading this into every schema means:
 *   - `createdAt`/`updatedAt` are real and maintained by Mongoose,
 *   - every model serialises `id` (previously only RecruiterProfile did, so
 *     every frontend consumer had to handle both `id` and `_id`),
 *   - `__v` never reaches the client.
 *
 * Models needing extras (a `transform` that strips secrets, renamed timestamp
 * fields) should spread this and override, not start from scratch — see
 * User.js and Application.js.
 */
/** `id` already carries the value, so `_id` is noise on the wire. */
export const stripInternalsTransform = (_doc, ret) => {
  delete ret._id;
  return ret;
};

export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true, transform: stripInternalsTransform },
  toObject: { virtuals: true },
};
