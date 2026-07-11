import { useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { Panel } from "./arena";

// FACEIT/tracker.gg-style "mini profile" card — fetched lazily when a
// player row is expanded (see Profile.jsx). `status` is "loading" | "error"
// | "ready"; the fields available in `data.stats` vary by discipline (e.g.
// Valorant has no reliable K/D source, Dota has no numeric MMR), so every
// stat cell is conditionally rendered instead of assuming a fixed shape.
export function PlayerStatsWidget({ status, data, error, onRetry }) {
  const { t } = useI18n();
  const [avatarFailed, setAvatarFailed] = useState(false);

  if (status === "loading") {
    return (
      <Panel clip className="p-4 mt-2 text-center text-xs text-[#a1a1aa] font-mono">
        {t("widget.loading")}
      </Panel>
    );
  }

  if (status === "error") {
    return (
      <Panel clip className="p-4 mt-2">
        <p className="text-[#ff0055] text-xs">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-xs text-cyan hover:underline">
            {t("widget.retry")}
          </button>
        )}
      </Panel>
    );
  }

  if (!data) return null;
  const { displayName, avatar, profileUrl, rank, eloOrMmr, stats, stale } = data;
  const cells = [
    stats.kd != null && { v: stats.kd.toFixed(2), l: "K/D" },
    stats.hsPercent != null && { v: `${Math.round(stats.hsPercent)}%`, l: "HS%" },
    stats.winratePercent != null && { v: `${Math.round(stats.winratePercent)}%`, l: "WIN%" },
    stats.winStreak != null && { v: stats.winStreak, l: "STREAK" },
  ].filter(Boolean);

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Panel clip className="p-4 mt-2">
        <div className="flex items-center gap-3">
          {avatar && !avatarFailed ? (
            <img
              src={avatar}
              alt=""
              onError={() => setAvatarFailed(true)}
              className="w-10 h-10 rounded-sm object-cover border border-[#27272a] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 border border-cyan/30 grid place-items-center shrink-0">
              <span className="w-3 h-3 border border-cyan/40 rotate-45" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-display font-bold text-white truncate">{displayName}</div>
            <div className="text-xs font-mono text-cyan truncate">{rank?.label}</div>
          </div>
          {eloOrMmr != null && (
            <div className="text-right shrink-0">
              <div className="font-mono text-2xl text-cyan leading-none">{eloOrMmr}</div>
            </div>
          )}
        </div>

        {cells.length > 0 && (
          <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
            {cells.map((c) => (
              <div key={c.l} className="text-center">
                <div className="font-mono text-sm text-white">{c.v}</div>
                <div className="overline text-[9px] mt-0.5">{c.l}</div>
              </div>
            ))}
          </div>
        )}

        {(stats.wins != null || stats.losses != null) && (
          <div className="flex gap-2 mt-3">
            <span className="flex-1 text-center py-1 bg-[#00ff66]/10 text-[#00ff66] text-xs font-mono rounded-sm">
              {stats.wins ?? "—"} W
            </span>
            <span className="flex-1 text-center py-1 bg-[#ff0055]/10 text-[#ff0055] text-xs font-mono rounded-sm">
              {stats.losses ?? "—"} L
            </span>
          </div>
        )}

        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="block mt-3 text-center text-xs text-cyan hover:underline"
          >
            {t("widget.viewProfile")}
          </a>
        )}
        {stale && <div className="mt-2 text-[10px] text-[#52525b] text-center">{t("widget.stale")}</div>}
      </Panel>
    </motion.div>
  );
}
