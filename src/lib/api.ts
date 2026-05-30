export type Metric = {
  label: string;
  value: string;
  delta: string;
};

export type Account = {
  name: string;
  health: "Strong" | "Watch" | "Risk";
  value: string;
  owner: string;
  nextStep: string;
};

export type Incident = {
  title: string;
  severity: "low" | "medium" | "high";
  status: "open" | "monitoring" | "resolved";
};

export type SessionState =
  | {
      authenticated: true;
      user: {
        id: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    }
  | {
      authenticated: false;
      reason: string;
    };

export type DashboardSnapshot = {
  metrics: Metric[];
  accounts: Account[];
  incidents: Incident[];
  source: "postgres" | "preview";
  message: string;
  session: SessionState;
};

const PREVIEW: DashboardSnapshot = {
  metrics: [
    { label: "Pipeline value", value: "$84.2k", delta: "+12.8%" },
    { label: "Active accounts", value: "1,284", delta: "+4.1%" },
    { label: "Needs review", value: "7", delta: "-2" },
    { label: "Median response", value: "14m", delta: "-8m" },
  ],
  accounts: [
    {
      name: "Northstar Labs",
      health: "Strong",
      value: "$18.4k",
      owner: "Mina",
      nextStep: "Expansion brief ready",
    },
    {
      name: "Copper Works",
      health: "Watch",
      value: "$9.8k",
      owner: "Jonas",
      nextStep: "Confirm usage change",
    },
  ],
  incidents: [
    {
      title: "Checkout latency is elevated for EU customers.",
      severity: "medium",
      status: "monitoring",
    },
  ],
  source: "preview",
  message: "Preview data is shown until the Node API and Postgres are configured.",
  session: { authenticated: false, reason: "preview" },
};

export async function loadSession(): Promise<SessionState> {
  try {
    const response = await fetch("/api/session", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Session request failed with ${response.status}`);
    }
    return (await response.json()) as SessionState;
  } catch {
    return { authenticated: false, reason: "api_unavailable" };
  }
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const response = await fetch("/api/dashboard", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Dashboard request failed with ${response.status}`);
    }
    return normalizeSnapshot(await response.json());
  } catch {
    return PREVIEW;
  }
}

function normalizeSnapshot(payload: unknown): DashboardSnapshot {
  const value = payload as Partial<DashboardSnapshot>;
  return {
    metrics: Array.isArray(value.metrics) ? value.metrics : PREVIEW.metrics,
    accounts: Array.isArray(value.accounts) ? value.accounts : PREVIEW.accounts,
    incidents: Array.isArray(value.incidents) ? value.incidents : PREVIEW.incidents,
    source: value.source === "postgres" ? "postgres" : "preview",
    message:
      typeof value.message === "string" && value.message.trim()
        ? value.message
        : PREVIEW.message,
    session: value.session ?? PREVIEW.session,
  };
}
