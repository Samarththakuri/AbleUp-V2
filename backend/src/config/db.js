import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Strips credentials out of a connection string for logging.
 *
 * MONGO_URI points at a hosted Atlas cluster and carries the password inline
 * (mongodb+srv://user:pass@host/db). Logging it raw put those credentials in
 * stdout, CI output and anything scraping the logs.
 */
export const redactUri = (uri) => uri.replace(/\/\/[^@/]+@/, "//<credentials>@");

export const connectDB = async () => {
  // env.MONGO_URI, not process.env: a localhost fallback here would let a
  // deploy with no MONGO_URI come up healthy against an empty local database
  // instead of failing at startup.
  const uri = env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${redactUri(uri)}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};
