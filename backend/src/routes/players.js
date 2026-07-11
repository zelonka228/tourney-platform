// Players API — external stats widget (FACEIT/Valorant lookup).
import { Router } from "express";
import prisma from "../db.js";
import { asyncHandler, HttpError, parseId } from "../http.js";
import { fetcherFor, IntegrationError } from "../integrations/index.js";

const router = Router();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — third-party APIs are rate-limited.

// GET /api/players/:id/stats[?refresh=1] → external profile stats, cached
// per-player. On a fetch failure, falls back to serving stale cached data
// (flagged with `stale: true`) instead of a hard error, if any exists.
router.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
    if (!player) throw new HttpError(404, "Гравця не знайдено.");
    if (!player.externalRef) {
      throw new HttpError(400, "У гравця не вказано посилання на зовнішній профіль.");
    }

    const fresh =
      req.query.refresh !== "1" &&
      player.externalStats &&
      player.externalStatsAt &&
      Date.now() - player.externalStatsAt.getTime() < CACHE_TTL_MS;
    if (fresh) {
      return res.json({ ...JSON.parse(player.externalStats), cachedAt: player.externalStatsAt, stale: false });
    }

    const fetcher = fetcherFor(player.team.discipline);
    if (!fetcher) throw new HttpError(400, "Дисципліна не підтримує зовнішню статистику.");

    try {
      const stats = await fetcher(player.externalRef);
      await prisma.player.update({
        where: { id },
        data: { externalStats: JSON.stringify(stats), externalStatsAt: new Date() },
      });
      return res.json({ ...stats, cachedAt: new Date(), stale: false });
    } catch (err) {
      if (player.externalStats) {
        return res.json({ ...JSON.parse(player.externalStats), cachedAt: player.externalStatsAt, stale: true });
      }
      if (err instanceof IntegrationError) throw new HttpError(err.status, err.message);
      throw err;
    }
  })
);

export default router;
