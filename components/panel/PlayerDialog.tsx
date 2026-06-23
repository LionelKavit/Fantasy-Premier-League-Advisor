"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import { fetchPlayerDetail, type PlayerDetail } from "@/lib/client/playerDetail";
import { plPlayerUrl } from "@/lib/client/fpl-links";
import { region } from "@/lib/fpl-regions";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, X } from "lucide-react";

interface OpenArgs {
  id: number;
  /** Shown in the header while the detail loads. */
  name: string;
}

const PlayerDialogContext = createContext<(args: OpenArgs) => void>(() => {});

/** Open the player detail dialog from anywhere under the provider. */
export function useOpenPlayerDialog(): (args: OpenArgs) => void {
  return useContext(PlayerDialogContext);
}

/**
 * Hosts the single player detail dialog and exposes an `open(id, name)` callback
 * via context, so a pitch token or a This-Week transfer name can open it without
 * prop-drilling. The body is keyed by player id so each open mounts fresh; the
 * detail endpoint serves from warm cache and is cached per id client-side, so
 * re-opening is instant.
 */
export function PlayerDialogProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<OpenArgs | null>(null);
  const open = useCallback((args: OpenArgs) => setTarget(args), []);

  return (
    <PlayerDialogContext.Provider value={open}>
      {children}
      <Dialog.Root open={target != null} onOpenChange={(o) => !o && setTarget(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Dialog.Close
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
            {target && <PlayerDetailBody key={target.id} target={target} />}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </PlayerDialogContext.Provider>
  );
}

function PlayerDetailBody({ target }: { target: OpenArgs }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Fresh per id (the parent keys this component by target.id), so the effect
  // only ever sets state from the async result — never synchronously.
  useEffect(() => {
    let active = true;
    fetchPlayerDetail(target.id)
      .then((d) => {
        if (active) {
          setDetail(d);
          setStatus("ready");
        }
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [target.id]);

  const nat = detail ? region(detail.regionId) : null;
  const plUrl = detail ? plPlayerUrl(detail.optaCode, detail.fullName) : null;

  return (
    <>
      {/* Header */}
      <div className="pr-6">
        <Dialog.Title className="text-lg font-extrabold leading-tight tracking-tight">
          {detail?.webName ?? target.name}
        </Dialog.Title>
        <Dialog.Description className="mt-0.5 text-xs font-medium uppercase tracking-wide text-fpl-cyan">
          {detail ? `${detail.position} · ${detail.team} · £${detail.price.toFixed(1)}` : "Loading player…"}
        </Dialog.Description>
      </div>

      {/* Body */}
      <div className="mt-3 min-h-[7rem]">
        {status === "loading" && (
          <div className="flex h-28 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {status === "error" && (
          <p className="flex h-28 items-center justify-center text-center text-sm text-muted-foreground">
            Couldn&rsquo;t load this player&rsquo;s details.
          </p>
        )}

        {status === "ready" && detail && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            {/* Row 1: Age · Nationality (flag after the country name) */}
            <Row label="Age" value={detail.age != null ? String(detail.age) : "—"} />
            {nat && <Row label="Nationality" value={`${nat.name} ${nat.flag}`} />}
            {/* Row 2: Form · Mins last week */}
            <Row label="Form" value={detail.form.toFixed(1)} />
            <Row
              label="Mins last week"
              value={detail.minutesLastWeek != null ? String(detail.minutesLastWeek) : "—"}
            />
            {/* Row 3: Pts last week · Exp. next pts (the projection, accented) */}
            <Row label="Pts last week" value={String(detail.pointsLastWeek)} />
            <Row
              label="Exp. next pts"
              value={detail.epNext != null ? detail.epNext.toFixed(1) : "—"}
              accent
            />
          </dl>
        )}
      </div>

      {/* Footer */}
      {status === "ready" && plUrl && (
        <a
          href={plUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-1.5 rounded-full border border-fpl-cyan/40 py-2 text-sm font-semibold text-white transition-colors hover:bg-fpl-cyan/10"
        >
          View on Premier League
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      {/* FPL data-forward: large, extrabold, tabular numbers */}
      <dd className={cn("text-xl font-extrabold leading-none tabular-nums", accent ? "text-fpl-green" : "text-white")}>
        {value}
      </dd>
    </div>
  );
}
