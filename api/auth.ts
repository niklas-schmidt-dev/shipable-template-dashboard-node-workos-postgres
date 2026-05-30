import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { WorkOS } from "@workos-inc/node";

const SESSION_COOKIE = "wos-session";
const STATE_COOKIE = "wos-state";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_MAX_AGE_MS = 5 * 60 * 1000;
const COOKIE_PASSWORD_REQUIREMENT =
  "WORKOS_COOKIE_PASSWORD must be at least 32 characters";

type SessionUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type SessionState =
  | {
      authenticated: true;
      user: SessionUser;
    }
  | {
      authenticated: false;
      reason: string;
    };

export function authConfigured() {
  return Boolean(
    process.env.WORKOS_API_KEY &&
      process.env.WORKOS_CLIENT_ID &&
      validCookiePassword(),
  );
}

export async function handleLogin(request: Request, response: Response) {
  if (!authConfigured()) {
    response.redirect(appOrigin());
    return;
  }

  const state = randomState();
  response.cookie(STATE_COOKIE, state, {
    ...authCookieOptions(request),
    maxAge: STATE_MAX_AGE_MS,
  });
  response.redirect(
    workosClient().userManagement.getAuthorizationUrl({
      provider: "authkit",
      redirectUri: redirectUri(),
      clientId: process.env.WORKOS_CLIENT_ID!,
      state,
    }),
  );
}

export async function handleCallback(request: Request, response: Response) {
  if (!authConfigured()) {
    response.redirect(appOrigin());
    return;
  }

  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  if (!code || !verifyState(request.cookies?.[STATE_COOKIE], state)) {
    clearAuthCookie(request, response, STATE_COOKIE);
    response.status(400).json({ error: "Invalid WorkOS callback." });
    return;
  }

  const result = await workosClient().userManagement.authenticateWithCode({
    code,
    clientId: process.env.WORKOS_CLIENT_ID!,
    session: {
      sealSession: true,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    },
  });

  response.cookie(SESSION_COOKIE, result.sealedSession, {
    ...authCookieOptions(request),
    maxAge: SESSION_MAX_AGE_MS,
  });
  clearAuthCookie(request, response, STATE_COOKIE);
  response.redirect(appOrigin());
}

export async function handleLogout(request: Request, response: Response) {
  clearAuthCookie(request, response, SESSION_COOKIE);
  clearAuthCookie(request, response, STATE_COOKIE);
  response.redirect(appOrigin());
}

export async function readAuthSession(request: Request): Promise<SessionState> {
  if (!authConfigured()) {
    return { authenticated: false, reason: "workos_not_configured" };
  }

  const sessionData = request.cookies?.[SESSION_COOKIE];
  if (typeof sessionData !== "string" || !sessionData) {
    return { authenticated: false, reason: "missing_session" };
  }

  try {
    const session = workosClient().userManagement.loadSealedSession({
      sessionData,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });
    const result = await session.authenticate();
    if (!result.authenticated) {
      return { authenticated: false, reason: result.reason ?? "unauthenticated" };
    }
    return {
      authenticated: true,
      user: {
        id: result.user.id,
        email: result.user.email ?? null,
        firstName: result.user.firstName ?? null,
        lastName: result.user.lastName ?? null,
      },
    };
  } catch (error) {
    return {
      authenticated: false,
      reason: "invalid_session",
    };
  }
}

function workosClient() {
  return new WorkOS(process.env.WORKOS_API_KEY!, {
    clientId: process.env.WORKOS_CLIENT_ID!,
  });
}

function redirectUri() {
  return process.env.WORKOS_REDIRECT_URI ?? "http://localhost:8787/callback";
}

function appOrigin() {
  return process.env.APP_ORIGIN ?? "http://localhost:5173";
}

function validCookiePassword() {
  const ok = (process.env.WORKOS_COOKIE_PASSWORD ?? "").length >= 32;
  if (!ok && process.env.WORKOS_COOKIE_PASSWORD) {
    console.warn(COOKIE_PASSWORD_REQUIREMENT);
  }
  return ok;
}

function authCookieOptions(request: Request): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    secure: secureCookie(request),
    sameSite: "lax",
  };
}

function clearAuthCookie(request: Request, response: Response, name: string) {
  response.cookie(name, "", {
    ...authCookieOptions(request),
    maxAge: 0,
  });
}

function secureCookie(request: Request) {
  return (
    process.env.NODE_ENV === "production" ||
    request.secure ||
    request.get("x-forwarded-proto") === "https"
  );
}

function randomState() {
  return randomBytes(32).toString("base64url");
}

function verifyState(cookieState: unknown, returnedState: string) {
  if (typeof cookieState !== "string" || !cookieState || !returnedState) {
    return false;
  }
  const expected = Buffer.from(cookieState);
  const actual = Buffer.from(returnedState);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
