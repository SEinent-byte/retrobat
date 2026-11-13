import { useEffect, useRef, useState } from "react";
import type { AdminIdentity } from "@retrobat/shared";
import { AdminApiError, adminApi, setToken } from "./api";
import { config } from "./config";

/** Admin sign-in via Google Identity Services. The returned id_token is
/// exchanged at POST /admin/auth/google, which gates on the admins table. */
export function Login({ onAuthed }: { onAuthed: (a: AdminIdentity) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.adminGoogleClientId) return;

    const gsi = window.google?.accounts.id;
    if (!gsi) {
      setError("Google sign-in script not loaded.");
      return;
    }

    gsi.initialize({
      client_id: config.adminGoogleClientId,
      callback: (res) => {
        void (async () => {
          setError(null);
          try {
            const out = await adminApi.authGoogle(res.credential);
            setToken(out.session.adminToken);
            onAuthed(out.admin);
          } catch (e) {
            if (e instanceof AdminApiError && e.code === "forbidden") {
              setError("That Google account is not an admin.");
            } else {
              setError(e instanceof AdminApiError ? e.message : String(e));
            }
          }
        })();
      },
    });

    if (btnRef.current) {
      gsi.renderButton(btnRef.current, { theme: "filled_black", size: "large" });
    }
  }, [onAuthed]);

  return (
    <div className="center">
      <div className="panel" style={{ maxWidth: 440 }}>
        <h1 style={{ marginTop: 0 }}>RetroBat Admin</h1>
        {config.adminGoogleClientId ? (
          <>
            <p className="muted">Sign in with your admin Google account.</p>
            <div ref={btnRef} style={{ display: "flex", justifyContent: "center" }} />
          </>
        ) : (
          <div style={{ textAlign: "left" }}>
            <p className="error">Admin Google client id not configured.</p>
            <p className="muted" style={{ fontSize: 13 }}>
              Create a Google OAuth <b>Web</b> client, add this site to its
              Authorized JavaScript origins, then set{" "}
              <code>VITE_ADMIN_GOOGLE_CLIENT_ID</code> in the Pages build
              environment and redeploy.
            </p>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
