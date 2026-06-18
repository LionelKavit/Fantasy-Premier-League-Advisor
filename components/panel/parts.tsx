import { cn } from "@/lib/utils";

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const cls =
    confidence === "high"
      ? "bg-fpl-green text-fpl-purple"
      : confidence === "medium"
        ? "bg-fpl-cyan text-fpl-purple"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", cls)}>
      {confidence} confidence
    </span>
  );
}

const CHIP_NAMES: Record<string, string> = {
  wildcard: "Wildcard",
  freeHit: "Free Hit",
  benchBoost: "Bench Boost",
  tripleCaptain: "Triple Captain",
};

export function chipName(chip: string): string {
  return CHIP_NAMES[chip] ?? chip;
}
