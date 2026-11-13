import { API_VERSION } from "@retrobat/shared";

/** Runtime config from Vite env (set in .env / Pages build vars). */
export const config = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ??
    "https://retrobat-api.anthoniogarciareyes25.workers.dev",
  /** Google WEB OAuth client id for admin sign-in (GIS). */
  adminGoogleClientId: import.meta.env.VITE_ADMIN_GOOGLE_CLIENT_ID ?? "",
  apiVersion: API_VERSION,
};
