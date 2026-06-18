import type { HorizonEntry } from "@/lib/optimizer/types";
import { cn } from "@/lib/utils";

const TIMING: Record<HorizonEntry["timing"], { label: string; gloss: string; cls: string }> = {
  BUY_NOW: {
    label: "Buy now",
    gloss: "Gains from GW+1 and stays ahead.",
    cls: "bg-fpl-green text-fpl-purple",
  },
  WAIT: {
    label: "Wait",
    gloss: "Pays off later — not yet.",
    cls: "bg-amber-400 text-black",
  },
  BUY_NOW_SELL_LATER: {
    label: "Buy now, sell later",
    gloss: "Early gain fades — plan to flip.",
    cls: "bg-fpl-cyan text-fpl-purple",
  },
};

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const w = 104;
  const h = 30;
  const pad = 4;
  const n = values.length;
  const all = [...values, 0];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const x = (i: number) => pad + (n > 1 ? (i / (n - 1)) * (w - 2 * pad) : 0);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const zeroY = y(0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[30px] w-[104px] shrink-0" role="img" aria-hidden="true">
      {/* zero baseline */}
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 2" />
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--fpl-green)" : "var(--fpl-pink)"}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HorizonSparkline({ entry }: { entry: HorizonEntry }) {
  const t = TIMING[entry.timing];
  const last = entry.cumulativeGain[entry.cumulativeGain.length - 1] ?? 0;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card/60 p-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          <span className="text-fpl-green">{entry.candidate.player.webName}</span>
          <span className="text-muted-foreground"> for </span>
          <span className="text-fpl-pink">{entry.weakPlayer.player.webName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", t.cls)}>{t.label}</span>
          {entry.fixtureSwing && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              fixture swing
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{t.gloss}</span>
        </div>
      </div>
      <Sparkline values={entry.cumulativeGain} positive={last >= 0} />
    </div>
  );
}
