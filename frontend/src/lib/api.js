/**
 * API base URL.
 *
 * Leave VITE_API_URL unset in development: "/api" is same-origin, so the Vite
 * dev proxy forwards it to the backend and the browser skips the CORS preflight
 * that used to precede every single request. In production set VITE_API_URL to
 * the absolute API base.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

/** Origin of the backend, for resolving relative upload paths like /uploads/... */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const getToken = () => localStorage.getItem("abelup_token");

/**
 * Error carrying the backend's machine-readable `code` (e.g.
 * RECRUITER_NOT_VERIFIED), so callers can branch on the reason instead of
 * matching message substrings.
 */
export class ApiError extends Error {
  status;
  code;
  data;

  constructor(status, message, code, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Reads a JSON body defensively — 204s and HTML error pages are not JSON. */
const parseBody = async (res) => {
  if (res.status === 204) return {};
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
};

export const api = async (endpoint, options = {}) => {
  const { method = "GET", body, headers = {} } = options;
  const token = getToken();

  const config = {
    method,
    headers: {
      // Gated on the same predicate as the body below, so the header and the
      // body can never disagree. On a bodyless GET this header buys nothing and
      // makes the request non-simple, i.e. a CORS preflight for no reason.
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data = await parseBody(res);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message || `Request failed (${res.status})`,
      data.code,
      data
    );
  }

  return data;
};

export const apiUpload = async (endpoint, formData, method = "POST") => {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      // No Content-Type — the browser sets the multipart boundary.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message || `Upload failed (${res.status})`,
      data.code,
      data
    );
  }
  return data;
};

/**
 * Turns a stored file path into a browsable URL. Server-relative paths
 * ("/uploads/logos/x.png") get the API origin prefixed; absolute URLs are
 * returned untouched, so a future move to Cloudinary needs no call-site edits.
 *
 * Only valid for *public* files. Verification documents are served from
 * /api/documents behind auth — a plain <img src> or <a href> to one of those
 * sends no Authorization header and gets a 401. Use `fetchProtectedFile`.
 */
export const resolveFileUrl = path => {
  if (!path) return undefined;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

/** True for paths served by the authenticated /api/documents route. */
export const isProtectedFile = (path) =>
  !!path && path.startsWith("/api/documents/");

/**
 * Fetches an access-controlled file with the bearer token and returns an object
 * URL for it.
 *
 * Verification documents cannot be linked to directly: the browser would not
 * attach the Authorization header, so the request would 401. Fetching to a blob
 * is also the reason previews render inline rather than opening a new tab —
 * `window.open` after an await is routinely blocked as a popup.
 *
 * Callers own the returned object URL and must revoke it (see
 * components/shared/DocumentViewer for the useEffect cleanup pattern).
 */
export const fetchProtectedFile = async path => {
  const token = getToken();
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await parseBody(res);
    throw new ApiError(
      res.status,
      data.message || `Could not load document (${res.status})`,
      data.code,
      data
    );
  }

  const blob = await res.blob();
  return {
    objectUrl: URL.createObjectURL(blob),
    contentType: res.headers.get("Content-Type") || blob.type,
  };
};
