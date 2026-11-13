/**
 * @retrobat/shared — frozen API contracts shared by backend and client.
 *
 * FROZEN before the multi-agent fan-out (SPEC §13.0.4, §14 step 1). Module
 * agents never edit this package. A contract change stops the fan-out and
 * re-freezes here, with an API_VERSION bump (version.ts).
 */

export * from "./version.js";
export * from "./enums.js";
export * from "./models.js";
export * from "./errors.js";
export * from "./api.js";
export * from "./admin.js";
export * from "./routes.js";
