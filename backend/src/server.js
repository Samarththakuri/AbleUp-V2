import "express-async-errors";
import { env } from "./config/env.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import logger, { httpLogStream } from "./utils/logger.js";
import authRoutes from "./routes/auth.js";
import candidateRoutes from "./routes/candidate.js";
import recruiterRoutes from "./routes/recruiter.js";
import adminRoutes from "./routes/admin.js";
import jobRoutes from "./routes/jobs.js";
import interviewRoutes from "./routes/interview.js";
import reviewRoutes from "./routes/reviews.js";
import documentRoutes from "./routes/documents.js";
import { errorHandler } from "./middleware/errorHandler.js";

// ESM has no __dirname. Resolves to backend/src, so "../uploads" below still
// points at backend/uploads — the same directory multer writes to.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = env.PORT;

/**
 * Must come before anything that reads req.ip — morgan's :remote-addr and
 * every rate limiter. See the TRUST_PROXY note in config/env.js for why this
 * is a hop count rather than `true`.
 */
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());

/**
 * Successful health checks and static file hits are volume without signal.
 * The status test comes first on purpose: a 404 under /uploads or a 429 on
 * /api/health is exactly the line worth keeping.
 *
 * `req.path` here is the full path ("/api/health") because morgan is mounted
 * globally. Inside `app.use("/api/", ...)` below, Express strips the prefix and
 * the same request is "/health" — which is why the health route is hoisted
 * above the limiters rather than skipped by path.
 */
const skipHttpLog = (req, res) => {
  if (res.statusCode >= 400) return false;
  return req.path === "/api/health" || req.path.startsWith("/uploads/");
};

/**
 * Above the rate limiters, and above cors(), by design. Morgan writes on the
 * response "finish" event, so its position decides what it *sees*: anything
 * that short-circuits above it is invisible. Below the limiters it would miss
 * every 429; below cors() it would miss every preflight, since cors() ends
 * OPTIONS without calling next().
 *
 * "tiny" rather than morgan's "dev" format: same information, without the ANSI
 * colour codes that would end up JSON-escaped inside logs/combined.log.
 */
app.use(
  morgan(env.NODE_ENV === "production" ? "combined" : "tiny", {
    stream: httpLogStream,
    skip: skipHttpLog,
  })
);

// maxAge lets the browser cache the preflight rather than re-issuing OPTIONS
// before every authenticated request. 600s is under Safari's cap.
app.use(cors({ origin: true, credentials: true, maxAge: 600 }));
app.use(express.json());

// Hoisted above the limiters so uptime monitors cannot exhaust the API budget.
app.get(
  "/api/health",
  (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() })
);

/**
 * Rate limiting, in three tiers. A single global limiter had to serve both a
 * credential-stuffing attempt and a recruiter clicking through their dashboard,
 * so it was necessarily too loose for one and too tight for the other.
 *
 * All of them are keyed by IP. Per-user keying would be fairer — everyone
 * behind one corporate NAT currently shares a bucket — but these are mounted at
 * the app level, above each router's `router.use(auth, ...)`, so req.user does
 * not exist yet.
 */
const rateLimited = (message) => (_req, res) =>
  // Matches the { success, message, code } envelope the rest of the API uses,
  // so the client's ApiError carries a branchable code rather than a bare
  // "Request failed (429)".
  res.status(429).json({ success: false, message, code: "RATE_LIMITED" });

const limiterDefaults = { standardHeaders: true, legacyHeaders: false };

// Credential stuffing and account enumeration. skipSuccessfulRequests means
// only failures count, so someone who keeps logging in correctly is never
// locked out of their own account.
const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  handler: rateLimited("Too many attempts. Please try again in a few minutes."),
});

// Mutations: cheap to abuse, and no legitimate client sends them in bursts.
const writeLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max: 30,
  skip: (req) => req.method === "GET" || req.method === "HEAD",
  handler: rateLimited("You are sending changes too quickly. Please slow down."),
});

// General read traffic. The previous 100 per 15 minutes was never survivable:
// one job detail view is 4 requests and a recruiter dashboard load is ~6, so
// ordinary browsing exhausted the window in minutes. ~40/min is generous for a
// human and still orders of magnitude below a runaway effect loop.
const apiLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: 600,
  handler: rateLimited("Too many requests, please try again later."),
});

// Most specific first — Express runs middleware in registration order.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/", writeLimiter);
app.use("/api/", apiLimiter);

/**
 * Unauthenticated static files: company logos and resumes.
 *
 * Verification documents are deliberately NOT here — they live in
 * ./private/verification and are served by /api/documents behind auth and an
 * ownership check. See middleware/upload.js.
 */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/documents", documentRoutes);

app.use(errorHandler);

const start = async () => {
  await connectDB();
  app.listen(PORT, () =>
    logger.info("Server listening", { port: PORT, env: env.NODE_ENV })
  );
};

// Without the catch, a connectDB() failure is an unhandled rejection rather
// than a diagnosable startup error.
start().catch((err) => {
  logger.error("Failed to start server", { stack: err.stack });
  process.exit(1);
});
