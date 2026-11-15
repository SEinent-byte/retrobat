import { useEffect, useState } from "react";
import type {
  AdminIdentity,
  AdminUserDto,
  GameDto,
  SystemDto,
} from "@retrobat/shared";
import { AdminApiError, adminApi, getToken, setToken } from "./api";
import { APP_NAME } from "./config";
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
        <div className="row" style={{ alignItems: "center", gap: 10 }}>
          <img src="/toro.png" alt="" width={32} height={32} style={{ display: "block" }} />
          <h1 style={{ margin: 0 }}>{APP_NAME} Admin</h1>
        </div>
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
  const [file, setFile] = useState<File | null>(null);
  const [trialEligible, setTrialEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [gamesVersion, setGamesVersion] = useState(0);

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

  const selected = systems.find((s) => s.id === systemId);
  const fileExt = file ? extOf(file.name) : "";
  const extAllowed = (s: SystemDto | undefined) =>
    !!s && s.extensions.some((e) => e.toLowerCase() === fileExt);
  const extOk = !file || extAllowed(selected);

  // Choosing a file drives everything: auto-pick the console whose extensions
  // match, and suggest a title from the filename (both stay editable).
  const onFile = (f: File | null) => {
    setDone(null);
    setFile(f);
    if (!f) return;
    const fx = extOf(f.name);
    if (!extAllowed(selected)) {
      const match = systems.find((s) =>
        s.extensions.some((e) => e.toLowerCase() === fx));
      if (match) setSystemId(match.id);
    }
    setTitle(titleFromFilename(f.name));
  };

  const addAndUpload = () =>
    run(async () => {
      if (!file || !systemId) return;
      setDone(null);
      setBusy(true);
      try {
        const game = await adminApi.createGame({
          systemId,
          title: title.trim() || titleFromFilename(file.name),
          romFilename: file.name,
          sizeBytes: file.size, // real length is re-measured server-side on upload
          trialEligible,
        });
        const res = await adminApi.uploadRom(game.id, file);
        setDone(`✓ "${game.title}" subido a ${game.systemId} — ${fmtBytes(res.sizeBytes)}.`);
        setTitle("");
        setFile(null);
        setTrialEligible(false);
        setGamesVersion((v) => v + 1);
      } finally {
        setBusy(false);
      }
    });

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
        {done && <div className="muted">{done}</div>}
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label>ROM / ISO file</label>
            <input
              type="file"
              key={file ? "has" : "empty"}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="auto from filename" />
          </div>
          <div className="field">
            <label>Trial</label>
            <input type="checkbox" checked={trialEligible} onChange={(e) => setTrialEligible(e.target.checked)} />
          </div>
          <button
            className="btn"
            onClick={addAndUpload}
            disabled={!systemId || !file || !extOk || busy}
          >
            {busy ? "Subiendo…" : "Add & upload"}
          </button>
        </div>
        {file && !extOk && (
          <div className="error">
            La extensión {fileExt || "(ninguna)"} no corresponde a {selected?.name}.
            {selected && <> Permitidas: {selected.extensions.join(" ")}.</>}
          </div>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Elige el archivo: la consola y el título se autocompletan; el tamaño real se mide al subir.
          Un solo paso crea el juego y sube la ROM a R2.
        </p>
      </div>

      <GamesManager systems={systems} reloadKey={gamesVersion} />

      <ReplaceRom />
    </>
  );
}

/* --------------------------- Games manager --------------------------- */

function GamesManager({
  systems,
  reloadKey,
}: {
  systems: SystemDto[];
  reloadKey: number;
}) {
  const { error, run } = useError();
  const [games, setGames] = useState<GameDto[]>([]);
  const [filter, setFilter] = useState("");

  const load = () =>
    run(async () => {
      setGames((await adminApi.listGames(filter || undefined)).games);
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reloadKey]);

  const sysName = (id: string) => systems.find((s) => s.id === id)?.name ?? id;

  const rename = (g: GameDto) =>
    run(async () => {
      const title = prompt("Nuevo título:", g.title);
      if (title == null || !title.trim() || title.trim() === g.title) return;
      await adminApi.updateGame(g.id, { title: title.trim() });
      await load();
    });

  const toggleTrial = (g: GameDto) =>
    run(async () => {
      await adminApi.updateGame(g.id, { trialEligible: !g.trialEligible });
      await load();
    });

  const move = (g: GameDto, systemId: string) =>
    run(async () => {
      if (systemId === g.systemId) return;
      await adminApi.updateGame(g.id, { systemId });
      await load();
    });

  const free24h = (g: GameDto) =>
    run(async () => {
      const now = Date.now();
      await adminApi.setFreeWindow(g.id, {
        freeFrom: now,
        freeUntil: now + 24 * 60 * 60 * 1000,
      });
      await load();
    });

  const clearFree = (g: GameDto) =>
    run(async () => {
      await adminApi.setFreeWindow(g.id, { freeFrom: null, freeUntil: null });
      await load();
    });

  const del = (g: GameDto) =>
    run(async () => {
      if (
        !confirm(
          `¿Borrar "${g.title}"? Elimina el juego y su ROM en R2. Irreversible.`,
        )
      )
        return;
      await adminApi.deleteGame(g.id);
      await load();
    });

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Games</h3>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All consoles</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="btn secondary" onClick={load}>Refresh</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Console</th>
            <th>Size</th>
            <th>Trial</th>
            <th>Free window</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td>
                {g.title}
                <button
                  className="btn secondary"
                  style={{ marginLeft: 8 }}
                  onClick={() => rename(g)}
                >
                  Rename
                </button>
                <div className="muted" style={{ fontSize: 11 }}>{g.romFilename}</div>
              </td>
              <td>
                <select value={g.systemId} onChange={(e) => move(g, e.target.value)}>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </td>
              <td className="muted">{fmtBytes(g.sizeBytes)}</td>
              <td>
                <input
                  type="checkbox"
                  checked={g.trialEligible}
                  onChange={() => toggleTrial(g)}
                />
              </td>
              <td className="muted">
                {freeWindowLabel(g)}{" "}
                <button className="btn secondary" onClick={() => free24h(g)}>24h</button>
                {(g.freeFrom != null || g.freeUntil != null) && (
                  <button className="btn secondary" onClick={() => clearFree(g)}>Clear</button>
                )}
              </td>
              <td>
                <button className="btn secondary" onClick={() => del(g)}>Delete</button>
              </td>
            </tr>
          ))}
          {games.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">No games.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12 }}>
        Trial = visible en cuentas de prueba. Free window = disponible para todos durante ese lapso (24h desde ahora).
        Mover de consola revalida la extensión y reubica la ROM en R2.
      </p>
    </div>
  );
}

function freeWindowLabel(g: GameDto): string {
  if (g.freeFrom == null && g.freeUntil == null) return "—";
  const now = Date.now();
  if (g.freeUntil != null && g.freeUntil < now) return "expired";
  if (g.freeFrom != null && g.freeFrom > now) return `from ${fmtDate(g.freeFrom)}`;
  return g.freeUntil != null ? `until ${fmtTime(g.freeUntil)}` : "active";
}

/* --------------------- Replace ROM (advanced) --------------------- */

function ReplaceRom() {
  const { error, run } = useError();
  const [gameId, setGameId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <details className="panel">
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Replace ROM of an existing game (advanced)
      </summary>
      {error && <div className="error">{error}</div>}
      {done && <div className="muted">{done}</div>}
      <div className="row" style={{ alignItems: "flex-end", marginTop: 12 }}>
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
        Overwrites the ROM at an existing game's R2 key; its size is updated to the real length.
      </p>
    </details>
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
function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}
function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "") // drop extension
    .replace(/[[(][^\])]*[\])]/g, " ") // drop (..) / [..] release tags
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
