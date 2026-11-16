import type {
  AdminAuthResponse,
  AdminBlockUserRequest,
  AdminBlockUserResponse,
  AdminCreateGameRequest,
  AdminCreateGameResponse,
  AdminDeleteGameResponse,
  AdminDeleteUserResponse,
  AdminFreeWindowRequest,
  AdminFreeWindowResponse,
  AdminGrantTimeRequest,
  AdminGrantTimeResponse,
  AdminListGamesResponse,
  AdminListSystemsResponse,
  AdminListUsersResponse,
  AdminNowPlayingResponse,
  AdminPromoteRequest,
  AdminPromoteResponse,
  AdminTopGamesResponse,
  AdminUpdateGameRequest,
  AdminUpdateGameResponse,
  AdminUploadRomResponse,
  AdminUpsertSystemRequest,
  AdminUpsertSystemResponse,
  ApiError,
} from "@retrobat/shared";
import { config } from "./config";

const TOKEN_KEY = "retrobat.admin.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class AdminApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Api-Version": config.apiVersion,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let code = "internal";
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as ApiError;
      code = err.error.code;
      message = err.error.message;
    } catch {
      /* keep defaults */
    }
    throw new AdminApiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Upload a raw binary body (ROM file) instead of JSON. */
async function requestBinary<T>(
  method: "POST",
  path: string,
  file: Blob,
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Api-Version": config.apiVersion,
    "Content-Type": "application/octet-stream",
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: file,
  });

  if (!res.ok) {
    let code = "internal";
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as ApiError;
      code = err.error.code;
      message = err.error.message;
    } catch {
      /* keep defaults */
    }
    throw new AdminApiError(code, message, res.status);
  }
  return (await res.json()) as T;
}

export const adminApi = {
  authGoogle: (idToken: string) =>
    request<AdminAuthResponse>("POST", "/admin/auth/google", { idToken }, false),

  listUsers: (q?: string) =>
    request<AdminListUsersResponse>(
      "GET",
      `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),

  grantTime: (userId: string, body: AdminGrantTimeRequest) =>
    request<AdminGrantTimeResponse>("POST", `/admin/users/${userId}/grant`, body),

  blockUser: (userId: string, body: AdminBlockUserRequest) =>
    request<AdminBlockUserResponse>("POST", `/admin/users/${userId}/block`, body),

  deleteUser: (userId: string) =>
    request<AdminDeleteUserResponse>("DELETE", `/admin/users/${userId}`),

  topGames: () =>
    request<AdminTopGamesResponse>("GET", "/admin/analytics/top-games"),

  nowPlaying: () =>
    request<AdminNowPlayingResponse>("GET", "/admin/analytics/now-playing"),

  listSystems: () =>
    request<AdminListSystemsResponse>("GET", "/admin/systems"),

  upsertSystem: (body: AdminUpsertSystemRequest) =>
    request<AdminUpsertSystemResponse>("POST", "/admin/systems", body),

  listGames: (systemId?: string) =>
    request<AdminListGamesResponse>(
      "GET",
      `/admin/games${systemId ? `?systemId=${encodeURIComponent(systemId)}` : ""}`,
    ),

  createGame: (body: AdminCreateGameRequest) =>
    request<AdminCreateGameResponse>("POST", "/admin/games", body),

  updateGame: (gameId: string, body: AdminUpdateGameRequest) =>
    request<AdminUpdateGameResponse>("PATCH", `/admin/games/${gameId}`, body),

  deleteGame: (gameId: string) =>
    request<AdminDeleteGameResponse>("DELETE", `/admin/games/${gameId}`),

  uploadRom: (gameId: string, file: File) =>
    requestBinary<AdminUploadRomResponse>("POST", `/admin/games/${gameId}/rom`, file),

  setFreeWindow: (gameId: string, body: AdminFreeWindowRequest) =>
    request<AdminFreeWindowResponse>(
      "POST",
      `/admin/games/${gameId}/free-window`,
      body,
    ),

  promote: (body: AdminPromoteRequest) =>
    request<AdminPromoteResponse>("POST", "/admin/admins", body),
};
