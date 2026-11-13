/**
 * Catalog + download business logic (SPEC §7, §10). No HTTP here. Visibility
 * and download access derive from the server-side license, never the client.
 */
import { and, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import {
  type CatalogResponse,
  type DownloadUrlResponse,
  type GameDto,
  LicenseStatus,
  type SystemDto,
} from "@retrobat/shared";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { fail } from "../lib/http.js";
import { presignDownload } from "../lib/r2.js";
import type { Env } from "../env.js";
import { getStatus } from "./license.js";

type GameRow = typeof schema.games.$inferSelect;
type SystemRow = typeof schema.systems.$inferSelect;

/** GET /catalog — systems (all) + games visible under the caller's license. */
export async function getCatalog(
  dbc: Db,
  userId: string,
  now = Date.now(),
): Promise<CatalogResponse> {
  const subscribed =
    (await getStatus(dbc, userId, now)).status === LicenseStatus.Subscribed;

  const systemRows = await dbc
    .select()
    .from(schema.systems)
    .orderBy(schema.systems.sortOrder)
    .all();

  const gameRows = subscribed
    ? await dbc.select().from(schema.games).all()
    : await dbc
        .select()
        .from(schema.games)
        .where(freeOrTrialEligible(now))
        .all();

  return {
    systems: systemRows.map(toSystemDto),
    games: gameRows.map(toGameDto),
  };
}

/** POST /download/url — validate access, return a presigned R2 URL. */
export async function getDownloadUrl(
  dbc: Db,
  env: Env,
  userId: string,
  gameId: string,
  now = Date.now(),
): Promise<DownloadUrlResponse> {
  const game = await dbc
    .select()
    .from(schema.games)
    .where(eq(schema.games.id, gameId))
    .get();
  if (!game) throw fail.notFound("game not found");

  const system = await dbc
    .select()
    .from(schema.systems)
    .where(eq(schema.systems.id, game.systemId))
    .get();
  if (!system) throw fail.notFound("system not found");

  const subscribed =
    (await getStatus(dbc, userId, now)).status === LicenseStatus.Subscribed;
  if (!subscribed && !isFreeOrTrial(game, now)) {
    throw fail.licenseRequired("this game needs an active subscription");
  }

  const { url, expiresAt } = await presignDownload(env, game.r2Key, now);

  return {
    url,
    expiresAt,
    romFilename: game.romFilename,
    sizeBytes: game.sizeBytes,
    sha256: null,
    retrobatFolder: system.retrobatFolder,
    defaultCore: system.defaultCore,
  };
}

/* ----------------------------- helpers ----------------------------- */

/** Access rule for non-subscribers (SPEC §10): trial_eligible OR free window. */
function freeOrTrialEligible(now: number) {
  return or(
    eq(schema.games.trialEligible, true),
    and(
      isNotNull(schema.games.freeFrom),
      lte(schema.games.freeFrom, now),
      gte(schema.games.freeUntil, now),
    ),
  );
}

function isFreeOrTrial(game: GameRow, now: number): boolean {
  if (game.trialEligible) return true;
  return (
    game.freeFrom != null &&
    game.freeUntil != null &&
    game.freeFrom <= now &&
    now <= game.freeUntil
  );
}

function toSystemDto(s: SystemRow): SystemDto {
  return {
    id: s.id,
    name: s.name,
    retrobatFolder: s.retrobatFolder,
    defaultCore: s.defaultCore,
    extensions: s.extensions
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    sortOrder: s.sortOrder,
  };
}

function toGameDto(g: GameRow): GameDto {
  return {
    id: g.id,
    systemId: g.systemId,
    title: g.title,
    romFilename: g.romFilename,
    sizeBytes: g.sizeBytes,
    trialEligible: g.trialEligible,
    freeFrom: g.freeFrom,
    freeUntil: g.freeUntil,
  };
}
