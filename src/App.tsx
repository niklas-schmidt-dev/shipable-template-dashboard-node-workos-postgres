import { useEffect, useMemo, useState } from "react";
import {
  loadDashboardSnapshot,
  loadSession,
  type Account,
  type DashboardSnapshot,
  type SessionState,
} from "./lib/api";

const healthCopy: Record<Account["health"], string> = {
  Strong: "Expansion ready",
  Watch: "Usage changed",
  Risk: "Executive review",
};

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSession(), loadDashboardSnapshot()])
      .then(([nextSession, nextSnapshot]) => {
        if (!cancelled) {
          setSession(nextSession);
          setSnapshot(nextSnapshot);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load dashboard.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSession = snapshot?.session ?? session;
  const metrics = snapshot?.metrics ?? [];
  const accounts = snapshot?.accounts ?? [];
  const incidents = snapshot?.incidents ?? [];
  const attentionCount = useMemo(
    () => accounts.filter((account) => account.health !== "Strong").length,
    [accounts],
  );

  return (
    <main className="app">
      <div className="layout">
        <aside className="side-panel" aria-label="Runtime summary">
          <div>
            <p className="eyebrow">WorkOS service app</p>
            <h1>Revenue command</h1>
            <p className="side-panel__copy">
              A React dashboard backed by a Node API, WorkOS AuthKit sessions,
              and durable Postgres reporting tables.
            </p>
          </div>
          <div className="runtime-stack">
            <RuntimePill label="Backend" value="Node API" />
            <RuntimePill label="Database" value={snapshot?.source ?? "Loading"} />
            <RuntimePill
              label="Session"
              value={
                activeSession?.authenticated
                  ? activeSession.user.email ?? "Signed in"
                  : "Signed out"
              }
            />
            {activeSession?.authenticated ? (
              <form action="/logout" method="post">
                <button className="auth-action" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <a className="auth-action" href="/login">
                Sign in with WorkOS
              </a>
            )}
          </div>
        </aside>

        <section className="workspace" aria-label="Revenue operations">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">Account health</p>
              <h2>Operations dashboard</h2>
            </div>
            <span className="workspace-header__status">
              {snapshot?.message ?? "Loading API state..."}
            </span>
          </header>

          <section className="summary-grid" aria-label="Key metrics">
            {(metrics.length > 0 ? metrics : fallbackMetrics).map((metric) => (
              <article key={metric.label} className="metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.delta}</small>
              </article>
            ))}
          </section>

          {error ? (
            <div className="notice" role="alert">
              {error}
            </div>
          ) : null}

          <section className="dashboard-grid">
            <section className="surface surface--large" aria-live="polite">
              <div className="surface__header">
                <div>
                  <p className="eyebrow">Priority book</p>
                  <h3>{attentionCount} accounts need attention</h3>
                </div>
                <span>{snapshot?.source ?? "loading"}</span>
              </div>
              {!snapshot ? (
                <EmptyState title="Loading account data" />
              ) : accounts.length === 0 ? (
                <EmptyState title="No accounts found" />
              ) : (
                <div className="account-list">
                  {accounts.map((account) => (
                    <article key={account.name} className="account-row">
                      <div>
                        <strong>{account.name}</strong>
                        <span>{account.nextStep || healthCopy[account.health]}</span>
                      </div>
                      <span className={`health health--${account.health.toLowerCase()}`}>
                        {account.health}
                      </span>
                      <span>{account.owner}</span>
                      <strong>{account.value}</strong>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="surface">
              <div className="surface__header">
                <div>
                  <p className="eyebrow">Incidents</p>
                  <h3>Open signals</h3>
                </div>
              </div>
              <div className="incident-list">
                {incidents.map((incident) => (
                  <article key={incident.title} className="incident">
                    <strong>{incident.title}</strong>
                    <span>
                      {incident.severity} severity · {incident.status}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}

const fallbackMetrics = [
  { label: "Pipeline value", value: "$84.2k", delta: "+12.8%" },
  { label: "Active accounts", value: "1,284", delta: "+4.1%" },
  { label: "Needs review", value: "7", delta: "-2" },
  { label: "Median response", value: "14m", delta: "-8m" },
];

function RuntimePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>Apply the SQL migrations and add rows to Postgres to replace preview data.</p>
    </div>
  );
}
