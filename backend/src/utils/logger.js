import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import winston from "winston";
import { env } from "../config/env.js";

// ESM has no __dirname. utils/ -> src/ -> backend/, so this resolves to
// backend/logs — already covered by .gitignore ("logs" and "*.log").
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "../../logs");

// winston's File transport creates the file but not missing parent directories.
// Without this the first write on a clean checkout is an unhandled ENOENT.
fs.mkdirSync(LOG_DIR, { recursive: true });

const isProd = env.NODE_ENV === "production";

/**
 * npm levels: error 0, warn 1, info 2, http 3, verbose 4, debug 5, silly 6.
 *
 * The production level is "http", not "info". "http" already exists in the
 * default hierarchy so morgan needs no custom level — but it sits *below*
 * "info", so setting "info" here would silently drop every request log, in
 * production only, which is the one place they matter most.
 */
const level = isProd ? "http" : "debug";

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// colorize() must come before printf() for `level` to arrive already coloured.
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // `service` is on every line from defaultMeta; repeating it per line on a
    // console you are already watching is noise.
    delete meta.service;
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${stack || message}${extra}`;
  })
);

/**
 * `tailable: true` matters: it keeps the newest content in combined.log itself
 * and shifts older content into combined.log1..4. Without it the numbering runs
 * the other way and `tail -f combined.log` follows a file that stops growing.
 */
const rotation = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };

const transports = [
  new winston.transports.File({
    filename: path.join(LOG_DIR, "error.log"),
    level: "error",
    format: fileFormat,
    ...rotation,
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, "combined.log"),
    format: fileFormat,
    ...rotation,
  }),
];

// In production the files are the record; a console transport would only
// duplicate them into stdout.
if (!isProd) {
  transports.push(new winston.transports.Console({ format: consoleFormat }));
}

const logger = winston.createLogger({
  level,
  defaultMeta: { service: "ableup-backend" },
  transports,
  exitOnError: false,
});

/**
 * The sink morgan writes into.
 *
 * Deliberately a separate export rather than `logger.stream`: winston 3
 * loggers already expose a `stream()` *method* (the log-query API), and
 * assigning a plain object over it breaks that silently.
 */
export const httpLogStream = {
  // morgan appends "\n"; winston adds its own line terminator.
  write: (message) => logger.http(message.trim()),
};

export default logger;
