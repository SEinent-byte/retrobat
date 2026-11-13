import { useEffect, useState } from "react";
import type {
  AdminIdentity,
  AdminUserDto,
  GameDto,
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
  const [created, setCreated] = useState<GameDto | null>(null);

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
      setCreated(game);
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
        {created && (
          <div className="muted">
            Added "{created.title}" ({created.id}). Upload its ROM below.
          </div>
        )}
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
          Registering a game only creates its catalog row. Upload the ROM file below.
        </p>
      </div>

      <UploadRom created={created} />
    </>
  );
}

/* ----------------------------- Upload ROM ----------------------------- */

function UploadRom({ created }: { created: GameDto | null }) {
  const { error, run } = useError();
  const [gameId, setGameId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill the id when a game was just created in the panel above.
  useEffect(() => {
    if (created) setGameId(created.id);
  }, [created]);

  const upload = () =>
    run(async () => {
      if (!gameId || !file) return;
      setDone(null);
      setBusy(true);
      try {
        const res = await adminApi.uploadRom(gameId.trim(), file);
        setDone(`Uploaded ${res.romFilename} — ${fmtBytes(res.sizeBytes)} (etag ${res.etag}).`);
        setFile(null);
      } finally {
        setBusy(false);
      }
    });

  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Upload ROM</h3>
      {error && <div className="error">{error}</div>}
      {done && <div className="muted">{done}</div>}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field">
          <label>Game id</label>
          <input
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="paste a game id"
            style={{ minWidth: 300 }}
          />
        </div>
        <div className="field">
          <label>ROM file</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <button className="btn" onClick={upload} disabled={!gameId || !file || busy}>
          {busy ? "Uploading…" : "Upload to R2"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        The file is stored at the game's R2 key; its registered size is updated to the real length.
      </p>
    </div>
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
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
