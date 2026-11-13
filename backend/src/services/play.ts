/**
 * Play analytics (SPEC §3, §11). A "start" opens a play_events row (duration
 * null = currently playing, used by admin now-playing); an "end" closes the
 * latest open row for that user+game. The frozen PlayEventRequest has no
 * event id, so "end" targets the open row rather than a specific id.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { PlayAction, type PlayEventResponse } from "@retrobat/shared";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { uuid } from "../lib/crypto.js";
import { fail } from "../lib/http.js";

export async function recordPlayEvent(
  dbc: Db,
  userId: string,
  input: { gameId: string; action: PlayAction; durationSec?: number },
  now = Date.now(),
): Promise<PlayEventResponse> {
  // Game must exist (FK would reject anyway; explicit for a clean error).
  const game = await dbc
    .select({ id: schema.games.id })
    .from(schema.games)
    .where(eq(schema.games.id, input.gameId))
    .get();
  if (!game) throw fail.notFound("game not found");

  if (input.action === PlayAction.Start) {
    const id = uuid();
    await dbc.insert(schema.playEvents).values({
      id,
      userId,
      gameId: input.gameId,
      startedAt: now,
      durationSec: null,
    });
    return { ok: true, eventId: id };
  }

  // End: close the latest open session for this user+game.
  const open = await dbc
    .select()
    .from(schema.playEvents)
    .where(
      and(
        eq(schema.playEvents.userId, userId),
        eq(schema.playEvents.gameId, input.gameId),
        isNull(schema.playEvents.durationSec),
      ),
    )
    .orderBy(desc(schema.playEvents.startedAt))
    .get();

  if (open) {
    const duration =
      input.durationSec ?? Math.max(0, Math.floor((now - open.startedAt) / 1000));
    await dbc
      .update(schema.playEvents)
      .set({ durationSec: duration })
      .where(eq(schema.playEvents.id, open.id));
    return { ok: true, eventId: open.id };
  }

  // No open session (e.g. app restarted): record a completed event.
  const id = uuid();
  await dbc.insert(schema.playEvents).values({
    id,
    userId,
    gameId: input.gameId,
    startedAt: now,
    durationSec: input.durationSec ?? 0,
  });
  return { ok: true, eventId: id };
}
