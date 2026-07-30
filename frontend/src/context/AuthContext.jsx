import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// Map backend role/status formats to frontend formats
const mapRole = role => {
  const lower = role.toLowerCase();
  if (lower === "candidate") return "candidate";
  if (lower === "recruiter") return "recruiter";
  if (lower === "admin") return "admin";
  return "candidate";
};

const mapVerification = status => {
  const lower = status.toLowerCase();
  if (lower === "verified" || lower === "approved") return "approved";
  if (lower === "rejected") return "rejected";
  if (lower === "pending") return "pending";
  return "none";
};

const mapUser = data => ({
  id: data.id || data._id,
  name: data.name,
  email: data.email,
  role: mapRole(data.role),
  verificationStatus: mapVerification(data.verificationStatus || "none"),
  rejectionReason: data.rejectionReason,
  disabilityType: data.disabilityType,
  udidNumber: data.udidNumber,
  forcePasswordChange: data.forcePasswordChange,
  recruiterProfile: (data.recruiterProfile) ?? null
});

export const AuthProvider = ({
  children
}) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("abelup_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("abelup_token"));

  useEffect(() => {
    if (user) localStorage.setItem("abelup_user", JSON.stringify(user));
    else localStorage.removeItem("abelup_user");
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem("abelup_token", token);
    else localStorage.removeItem("abelup_token");
  }, [token]);

  /**
   * Every function exposed on the context is memoised, and the deps are `[]`
   * rather than a lint workaround: none of them reads `user` or `token`, only
   * their own arguments, module-scope helpers and React's stable setters.
   *
   * The identities are load-bearing. `useRecruiterProfile` builds a
   * useCallback chain on top of `updateUser` that terminates in a useEffect
   * dependency array, so an unstable identity there is not a wasted render —
   * it is an unbounded GET /recruiter/profile loop. See BUGS.md F-05.
   */
  const login = useCallback(async (email, password) => {
    // No mock fallback — always hit the real backend
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const mapped = mapUser(data.user);
    setToken(data.token);
    setUser(mapped);
    // Returned so callers can route immediately without waiting for a re-render.
    return mapped;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  const register = useCallback(async (data) => {
    // No mock fallback — always hit the real backend
    const res = await api("/auth/register", {
      method: "POST",
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role.toUpperCase(),
        ...(data.role === "candidate"
          ? { disabilityType: data.disabilityType, udidNumber: data.udidNumber }
          : { companyName: data.companyName }),
      },
    });
    const mapped = mapUser(res.user);
    setToken(res.token);
    setUser(mapped);
    return mapped;
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      // Returning `prev` unchanged is the point, not an optimisation:
      // useRecruiterProfile re-sends the same recruiterProfile summary after
      // every load and save, and handing back a fresh object each time
      // re-rendered every useAuth() consumer and rewrote localStorage for a
      // value that had not changed.
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, []);

  /**
   * Refreshes the cached user. Needed because verificationStatus and
   * onboardingStatus change server-side (admin approval, profile submission)
   * without the client re-authenticating.
   */
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem("abelup_token")) return null;
    try {
      const res = await api("/auth/me");
      const mapped = mapUser(res.user);
      setUser(mapped);
      return mapped;
    } catch {
      // Offline or expired token — keep the cached user rather than logging
      // out mid-session; protected requests will surface the 401 themselves.
      return null;
    }
  }, []);

  // With every member above stable, this only changes when user or token does.
  // Memoising it anyway keeps that guarantee true the day a third piece of
  // state joins the provider.
  const value = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      register,
      updateUser,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, token, login, logout, register, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
