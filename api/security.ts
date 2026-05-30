import type { NextFunction, Request, Response } from "express";

const securityHeaderValues: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  for (const [name, value] of Object.entries(securityHeaderValues)) {
    response.setHeader(name, value);
  }
  next();
}

export function noStore(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader("Cache-Control", "no-store");
  next();
}
