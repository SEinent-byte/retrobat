# @retrobat/shared

Versioned API contracts (request/response types, enums, entity DTOs, route
map) shared by backend and client so they never drift.

**Frozen before the multi-agent fan-out** (SPEC §13.0.4, §14 step 1). Never
edited from a module agent; a contract change stops the fan-out, re-freezes
here, and bumps `API_VERSION` (`src/version.ts`).

## Layout (`src/`)

| File         | Contents |
|--------------|----------|
| `version.ts` | `API_VERSION`, `API_VERSION_HEADER`. |
| `enums.ts`   | Closed string sets: `LicenseStatus`, `SubscriptionStatus`, `PlayAction`, `AbuseState`. |
| `models.ts`  | Entity DTOs: `UserDto`, `DeviceSignals`/`DeviceIdentity`, `SystemDto`, `GameDto`, `SubscriptionDto`, `LicenseState`. Timestamps are `EpochMs` (UTC). |
| `errors.ts`  | `ApiError` envelope + `ApiErrorCode`. Every non-2xx body uses this. |
| `api.ts`     | Client-facing endpoint request/response pairs (SPEC §11). |
| `admin.ts`   | Admin-panel endpoint contracts (SPEC §10). |
| `routes.ts`  | `ROUTES` map (path + method + auth kind) — canonical URLs. |

## Consumers

- **Backend** (`@retrobat/shared` workspace dep): imports these types and
  implements/validates against them.
- **Client** (C# / .NET): not a pnpm consumer. The WPF client mirrors these
  contracts as C# DTOs by hand; `API_VERSION` + the `X-Api-Version` header
  catch drift at runtime. Keep names 1:1 with this package.

## Conventions

- Pure type-only package, zero runtime deps. `const` objects + union types
  instead of TS `enum` (survives `isolatedModules`, clean JSON, easy C#).
- All timestamps epoch **milliseconds**, UTC, server authority (SPEC §6).
- Success bodies only in `*Response`; failures always use `ApiError`.
