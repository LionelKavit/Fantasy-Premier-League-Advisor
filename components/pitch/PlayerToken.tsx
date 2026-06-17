"use client";

import { useState } from "react";
import type { SquadPlayerView } from "@/lib/plan/types";
import { shirtUrl, scoreToRating, ratingTier } from "@/lib/client/formation";
import { cn } from "@/lib/utils";

const TINTS = ["#e90052", "#00d4e6", "#963cff", "#00ff87", "#f5a623", "#ff6b35"];

function FallbackJersey({ teamCode, label }: { teamCode: number; label: string }) {
  const fill = TINTS[teamCode % TINTS.length];
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" role="img" aria-label={label}>
      <path
        d="M14 4 L8 8 L4 14 L8 18 L11 15 L11 36 L29 36 L29 15 L32 18 L36 14 L32 8 L26 4 L23 7 Q20 9 17 7 Z"
        fill={fill}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
    </svg>
  );
}

function availabilityInfo(a: SquadPlayerView["availability"]):
  | { label: string; cls: string }
  | null {
  switch (a.status) {
    case "injured":
      return { label: "INJ", cls: "bg-[#e90052] text-white" };
    case "suspended":
      return { label: "SUS", cls: "bg-[#e90052] text-white" };
    case "unavailable":
      return { label: "N/A", cls: "bg-gray-500 text-white" };
    case "doubtful":
      return {
        label: a.chanceOfPlayingNext != null ? `${a.chanceOfPlayingNext}` : "?",
        cls: "bg-[#f5a623] text-[#37003c]",
      };
    default:
      return null;
  }
}

// Rating as coloured TEXT on the footer (FPL uses coloured text, not filled boxes).
const TIER_TEXT: Record<string, string> = {
  good: "text-[#00ff87]",
  ok: "text-white",
  poor: "text-[#ff6b81]",
};

export function PlayerToken({
  player,
  isTransferOut = false,
}: {
  player: SquadPlayerView;
  isTransferOut?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const isGk = player.position === "GK";
  const alt = `${player.webName}, ${player.teamShortName}`;
  const rating = scoreToRating(player.score);
  const tier = ratingTier(rating);
  const avail = availabilityInfo(player.availability);

  return (
    <div
      className={cn(
        // Frosted translucent card so the pitch shows through (not an opaque tile).
        "relative w-[64px] overflow-hidden rounded-md border bg-white/10 shadow-sm backdrop-blur-sm sm:w-[84px]",
        isTransferOut
          ? "border-[#e90052] ring-2 ring-[#e90052]/70"
          : player.isWeakSpot
            ? "border-[#f5a623] ring-2 ring-[#f5a623]/70"
            : "border-white/15"
      )}
      title={alt}
    >
      {/* Top-left: weak / transfer-out marker — small so it stays a tidy corner chip */}
      {(isTransferOut || player.isWeakSpot) && (
        <span
          className={cn(
            "absolute left-0.5 top-0.5 z-10 rounded-sm px-0.5 text-[7px] font-extrabold leading-[11px]",
            isTransferOut ? "bg-[#e90052] text-white" : "bg-[#f5a623] text-[#37003c]"
          )}
        >
          {isTransferOut ? "OUT" : "▲"}
        </span>
      )}

      {/* Top-right: captain / vice circle */}
      {(player.isCaptainRec || player.isViceRec) && (
        <span
          className={cn(
            "absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold",
            player.isCaptainRec
              ? "bg-[#00ff87] text-[#37003c]"
              : "border border-white bg-white text-[#37003c]"
          )}
          aria-label={player.isCaptainRec ? "Captain" : "Vice-captain"}
        >
          {player.isCaptainRec ? "C" : "V"}
        </span>
      )}

      {/* Shirt body (availability flag pinned to its bottom-left) */}
      <div className="relative flex h-10 items-center justify-center px-2 pt-1.5 sm:h-12">
        {imgError ? (
          <FallbackJersey teamCode={player.teamCode} label={alt} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shirtUrl(player.teamCode, isGk)}
            alt={alt}
            className="h-full w-full object-contain drop-shadow-sm"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
        {avail && (
          <span
            className={cn(
              "absolute bottom-0 left-0 z-10 rounded px-1 text-[8px] font-bold leading-3",
              avail.cls
            )}
          >
            {avail.label}
          </span>
        )}
      </div>

      {/* Footer: full name on one line + rating (coloured) + price */}
      <div className="bg-[#37003c]/80 px-1 pb-1 pt-0.5 text-center leading-tight">
        <p className="truncate text-[10px] font-bold tracking-tight text-white sm:text-[11px]">
          {player.webName}
        </p>
        <p className="leading-none">
          <span
            className={cn("text-xs font-extrabold tabular-nums", TIER_TEXT[tier])}
            aria-label={`Projected rating ${rating.toFixed(1)} out of 10`}
          >
            {rating.toFixed(1)}
          </span>
          <span className="ml-1 text-[9px] tabular-nums text-white/55">
            £{player.price.toFixed(1)}
          </span>
        </p>
      </div>
    </div>
  );
}
