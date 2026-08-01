//using some princicples of production
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
