import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";

export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    // "Only call this function if header exists."
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = header.split(" ")[1];
    // env.JWT_SECRET, not process.env: config/env.js has already rejected a
    // missing or too-short secret at startup. A `|| "secret"` fallback here
    // would mean a misconfigured deploy silently accepts forged tokens.
    const decoded = jwt.verify(token, env.JWT_SECRET);
    // No .select("-password") needed — password and the token fields are
    // `select: false` on the schema, so they are excluded by default now.
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    req.user = user;
    next(); //aage badhna hai to next function that is why
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
