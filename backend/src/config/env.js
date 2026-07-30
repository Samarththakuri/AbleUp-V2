import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000"),
  MONGO_URI: z.string().url("MONGO_URI must be a valid URL"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters long"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /**
   * Number of reverse-proxy hops in front of this server. 0 = exposed directly.
   *
   * Deliberately a hop count and not Express's `true`: express-rate-limit
   * refuses to run behind a permissive trust-proxy setting, because a client
   * could then forge X-Forwarded-For and hand itself a fresh rate-limit bucket
   * on every request.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:");
  _env.error.issues.forEach((issue) => {
    console.error(`${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = _env.data;
