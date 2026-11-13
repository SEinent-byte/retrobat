/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Google Identity Services global (loaded via index.html script). */
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(opts: {
          client_id: string;
          callback: (res: { credential: string }) => void;
        }): void;
        renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        prompt(): void;
      };
    };
  };
}
