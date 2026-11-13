import { useEffect, useState } from "react";
import type {
  AdminIdentity,
  AdminUserDto,
  SystemDto,
} from "@retrobat/shared";
import { AdminApiError, adminApi, getToken, setToken } from "./api";
import { config } from "./config";
import { Login } from "./Login";

type Tab = "users" | "catalog" | "analytics";

export function App() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("users");

  // Resume a stored session; verify it by making an authed call.
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    adminApi
      .listUsers()
      .then(() => setAdmin({ id: "me", email: "admin" }))
      .catch(() => {
        setToken(null);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="center">Loading…</div>;

  if (!admin) {
    return <Login onAuthed={(a) => setAdmin(a)} />;
  }

  const signOut = () => {
    setToken(null);
    setAdmin(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>RetroBat Admin</h1>
        <div className="row">
          <span className="muted">{admin.email}</span>
          <button className="btn secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>
          Consoles &amp; Games
        </button>
        <button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>
          Analytics
        </button>
      </nav>

      {tab === "users" && <Users />}
      {tab === "catalog" && <Catalog />}
      {tab === "analytics" && <Analytics />}
    </div>
  );
}

function useError() {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof AdminApiError ? `${e.code}: ${e.message}` : String(e));
    }
  };
  return { error, run };
}

/* ------------------------------ Users ------------------------------ */

function Users() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [q, setQ] = useState("");
  const { error, run } = useError();

  const load = () => run(async () => setUsers((await adminApi.listUsers(q || undefined)).users));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grant = (u: AdminUserDto) =>
    run(async () => {
      const days = Number(prompt(`Add how many trial days for ${u.email}?`, "7"));
      if (!Number.isFinite(days) || days === 0) return;
      await adminApi.grantTime(u.id, { extendTrialMs: days * 24 * 60 * 60 * 1000 });
      await load();
    });

  const promote = () =>
    run(async () => {
      const email = prompt("Promote which user email to admin?");
      if (!email) return;
      await adminApi.promote({ email });
      alert(`${email} is now an admin.`);
    });

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={load}>
          Search
        </button>
        <button className="btn secondary" onClick={promote}>
          Promote admin
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>License</th>
            <th>Trial ends</th>
            <th>Abuse</th>
            <th>Device</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}{u.blocked && <span className="tag"> blocked</span>}</td>
              <td>{u.licenseStatus}</td>
              <td>{fmtDate(u.trialExpiresAt)}</td>
              <td>{u.abuseScore} {u.abuseState === "under_review" ? "⚠" : ""}</td>
              <td className="muted">{u.deviceFingerprint ? u.deviceFingerprint.slice(0, 10) + "…" : "—"}</td>
              <td>
                <button className="btn secondary" onClick={() => grant(u)}>
                  Grant time
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">No users.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Consoles & Games --------------------------- */

function Catalog() {
  const [systems, setSystems] = useState<SystemDto[]>([]);
  const { error, run } = useError();

  const [systemId, setSystemId] = useState("");
  const [title, setTitle] = useState("");
  const [romFilename, setRomFilename] = useState("");
  const [sizeBytes, setSizeBytes] = useState("0");
  const [trialEligible, setTrialEligible] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const load = () =>
    run(async () => {
      const s = (await adminApi.listSystems()).systems;
      setSystems(s);
      if (!systemId && s[0]) setSystemId(s[0].id);
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addGame = () =>
    run(async () => {
      setCreated(null);
      const game = await adminApi.createGame({
        systemId,
        title,
        romFilename,
        sizeBytes: Number(sizeBytes) || 0,
        trialEligible,
      });
      setCreated(`Added "${game.title}" (${game.id}).`);
      setTitle("");
      setRomFilename("");
      setSizeBytes("0");
      setTrialEligible(false);
    });

  const selected = systems.find((s) => s.id === systemId);

  return (
    <>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Consoles</h3>
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Folder</th>
              <th>Core</th>
              <th>Extensions</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td className="muted">{s.retrobatFolder}</td>
                <td className="muted">{s.defaultCore ?? "—"}</td>
                <td className="muted">{s.extensions.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add game</h3>
        {error && <div className="error">{error}</div>}
        {created && <div className="muted">{created}</div>}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label>Console</label>
            <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>ROM filename {selected && <span>({selected.extensions.join(" ")})</span>}</label>
            <input value={romFilename} onChange={(e) => setRomFilename(e.target.value)} placeholder="game.nes" />
          </div>
          <div className="field">
            <label>Size (bytes)</label>
            <input value={sizeBytes} onChange={(e) => setSizeBytes(e.target.value)} />
          </div>
          <div className="field">
            <label>Trial</label>
            <input type="checkbox" checked={trialEligible} onChange={(e) => setTrialEligible(e.target.checked)} />
          </div>
          <button className="btn" onClick={addGame} disabled={!systemId || !title || !romFilename}>
            Add
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          The ROM file itself is uploaded to R2 separately; this registers its catalog entry.
        </p>
      </div>
    </>
  );
}

/* ---------------------------- Analytics ---------------------------- */

function Analytics() {
  const { error, run } = useError();
  const [top, setTop] = useState<{ gameId: string; title: string; playCount: number; totalDurationSec: number }[]>([]);
  const [now, setNow] = useState<{ userId: string; email: string; title: string; startedAt: number }[]>([]);

  const load = () =>
    run(async () => {
      setTop((await adminApi.topGames()).games);
      setNow((await adminApi.nowPlaying()).sessions);
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Now playing</h3>
          <button className="btn secondary" onClick={load}>Refresh</button>
        </div>
        <table>
          <thead>
            <tr><th>User</th><th>Game</th><th>Since</th></tr>
          </thead>
          <tbody>
            {now.map((s, i) => (
              <tr key={i}>
                <td>{s.email}</td>
                <td>{s.title}</td>
                <td className="muted">{fmtTime(s.startedAt)}</td>
              </tr>
            ))}
            {now.length === 0 && <tr><td colSpan={3} className="muted">Nobody playing.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Top games</h3>
        <table>
          <thead>
            <tr><th>Game</th><th>Plays</th><th>Total time</th></tr>
          </thead>
          <tbody>
            {top.map((g) => (
              <tr key={g.gameId}>
                <td>{g.title}</td>
                <td>{g.playCount}</td>
                <td className="muted">{fmtDuration(g.totalDurationSec)}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td colSpan={3} className="muted">No plays yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------ utils ------------------------------ */

function fmtDate(ms: number | null): string {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
