import type { Express, Request, Response } from "express";
import {
  authConfigured,
  handleCallback,
  handleLogin,
  handleLogout,
  readAuthSession,
  type SessionState,
} from "./auth.js";
import { databaseConfigured, query } from "./db.js";

type MetricRow = {
  label: string;
  value: string;
  delta: string;
  sort_order: number;
};

type AccountRow = {
  name: string;
  health: "Strong" | "Watch" | "Risk";
  value: string;
  owner: string;
  next_step: string;
};

type IncidentRow = {
  title: string;
  severity: "low" | "medium" | "high";
  status: "open" | "monitoring" | "resolved";
};

const PREVIEW_METRICS = [
  { label: "Pipeline value", value: "$84.2k", delta: "+12.8%" },
  { label: "Active accounts", value: "1,284", delta: "+4.1%" },
  { label: "Needs review", value: "7", delta: "-2" },
  { label: "Median response", value: "14m", delta: "-8m" },
];

const PREVIEW_ACCOUNTS = [
  {
    name: "Northstar Labs",
    health: "Strong" as const,
    value: "$18.4k",
    owner: "Mina",
    nextStep: "Expansion brief ready",
  },
  {
    name: "Copper Works",
    health: "Watch" as const,
    value: "$9.8k",
    owner: "Jonas",
    nextStep: "Confirm usage change",
  },
  {
    name: "Atlas Finance",
    health: "Risk" as const,
    value: "$22.6k",
    owner: "Priya",
    nextStep: "Escalate support SLA",
  },
];

const PREVIEW_INCIDENTS = [
  {
    title: "Checkout latency is elevated for EU customers.",
    severity: "medium" as const,
    status: "monitoring" as const,
  },
  {
    title: "Two enterprise accounts missed the weekly sync.",
    severity: "low" as const,
    status: "open" as const,
  },
];

export function registerRoutes(app: Express) {
  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      database: databaseConfigured() ? "configured" : "missing",
      workos: authConfigured() ? "configured" : "missing",
    });
  });

  app.get("/api/session", async (request, response, next) => {
    try {
      response.json(await readAuthSession(request));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dashboard", async (request, response, next) => {
    try {
      const session = await requireAuthenticatedSession(request, response);
      if (!session) {
        return;
      }
      response.json({
        ...(await loadDashboardSnapshot(session)),
        session,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/login", handleLogin);
  app.get("/callback", handleCallback);
  app.post("/logout", handleLogout);
  app.all("/logout", (_request, response) => {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
  });

}

async function requireAuthenticatedSession(
  request: Request,
  response: Response,
) {
  const session = await readAuthSession(request);
  if (databaseConfigured() && !authConfigured()) {
    response.status(503).json({
      error: "WorkOS authentication must be configured before dashboard data is exposed",
      session,
    });
    return null;
  }
  if ((authConfigured() || databaseConfigured()) && !session.authenticated) {
    response.status(401).json({
      error: "Authentication required",
      session,
    });
    return null;
  }
  return session;
}

async function loadDashboardSnapshot(session: SessionState) {
  if (!databaseConfigured()) {
    return {
      metrics: PREVIEW_METRICS,
      accounts: PREVIEW_ACCOUNTS,
      incidents: PREVIEW_INCIDENTS,
      source: "preview" as const,
      message:
        "Preview data is shown until DATABASE_URL points at a Postgres database with migrations applied.",
    };
  }
  if (!session.authenticated) {
    throw new Error("authenticated WorkOS session is required");
  }
  const subject = session.user.id;

  const [metricRows, accountRows, incidentRows] = await Promise.all([
    query(`
      select label, value, delta, sort_order
      from dashboard_metrics
      where workos_subject = $1
      order by sort_order asc
      limit 8
    `, [subject]) as Promise<MetricRow[]>,
    query(`
      select name, health, value, owner, next_step
      from account_health
      where workos_subject = $1
      order by case health when 'Risk' then 0 when 'Watch' then 1 else 2 end, name asc
      limit 12
    `, [subject]) as Promise<AccountRow[]>,
    query(`
      select title, severity, status
      from incidents
      where status <> 'resolved' and workos_subject = $1
      order by created_at desc
      limit 6
    `, [subject]) as Promise<IncidentRow[]>,
  ]);

  return {
    metrics: metricRows.map((row) => ({
      label: row.label,
      value: row.value,
      delta: row.delta,
    })),
    accounts: accountRows.map((row) => ({
      name: row.name,
      health: row.health,
      value: row.value,
      owner: row.owner,
      nextStep: row.next_step,
    })),
    incidents: incidentRows,
    source: "postgres" as const,
    message: "Loaded from Postgres through the authenticated Node API.",
  };
}
