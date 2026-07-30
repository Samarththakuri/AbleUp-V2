/**
 * Fails the build when the backend and frontend option lists drift apart.
 *
 * Both sides carry the same vocabularies: the backend enforces them as schema
 * enums, the frontend renders them as checkboxes and selects. The "keep both in
 * sync" comments at the top of each constants file were the only thing holding
 * that together, and a value the frontend offers but the backend rejects is a
 * 500 the user cannot do anything about.
 *
 * Run:  npm run check:constants
 *
 * Deliberately a text parser rather than an import of the frontend module: the
 * frontend is a separate package with its own node_modules and its own `@/`
 * alias, so importing across the project boundary would not resolve here.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_CONSTANTS = path.resolve(__dirname, "../constants");
const FRONTEND_CONSTANTS = path.resolve(__dirname, "../../../frontend/src/constants/company.js");

/** Every list that must exist identically on both sides. */
const MIRRORED_LISTS = [
  "COMPANY_ACCESSIBILITY_FACILITIES",
  "COMPANY_SIZES",
  "INDUSTRIES",
  "DISABILITY_TYPES",
  "WORK_HOUR_OPTIONS",
  "JOB_ACCESSIBILITY_EXTRAS",
  "RECRUITER_DOC_TYPES",
  "CANDIDATE_DOC_TYPES",
];

/**
 * Pulls `export const NAME = [ "a", "b" ];` out of a source file.
 * Only string-literal members are collected, so composed lists (the ones built
 * by spreading other lists) are skipped — checking their parts covers them.
 */
const parseLists = source => {
  const found = new Map();
  const declaration = /export const ([A-Z0-9_]+)\s*=\s*\[([^\]]*)\]/g;

  for (const [, name, body] of source.matchAll(declaration)) {
    if (body.includes("...")) continue;
    const values = [...body.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    found.set(name, values);
  }

  return found;
};

const readBackendLists = () => {
  const merged = new Map();

  for (const file of fs.readdirSync(BACKEND_CONSTANTS)) {
    if (!file.endsWith(".js") || file === "index.js") continue;
    const source = fs.readFileSync(path.join(BACKEND_CONSTANTS, file), "utf8");
    for (const [name, values] of parseLists(source)) merged.set(name, values);
  }

  return merged;
};

const main = () => {
  const backend = readBackendLists();
  const frontend = parseLists(fs.readFileSync(FRONTEND_CONSTANTS, "utf8"));
  const problems = [];

  for (const name of MIRRORED_LISTS) {
    const b = backend.get(name);
    const f = frontend.get(name);

    if (!b) {
      problems.push(`${name}: missing from backend/src/constants/`);
      continue;
    }
    if (!f) {
      problems.push(`${name}: missing from frontend/src/constants/company.js`);
      continue;
    }
    if (b.join("\u0000") !== f.join("\u0000")) {
      problems.push(
        `${name}: values differ\n    backend:  ${JSON.stringify(b)}\n    frontend: ${JSON.stringify(f)}`
      );
    }
  }

  if (problems.length) {
    console.error("\n[check:constants] backend and frontend have drifted:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("");
    process.exit(1);
  }

  console.log(
    `[check:constants] ok — ${MIRRORED_LISTS.length} lists identical on both sides`
  );
};

main();
