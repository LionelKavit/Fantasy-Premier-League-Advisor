"use client";

import { useEffect, useState, useCallback } from "react";
import type { GameweekPlan } from "@/lib/plan/types";
import { fetchPlanBase, fetchPlanInsights } from "@/lib/client/plan";
import { ManagerIdForm } from "@/components/ManagerIdForm";
import { Header } from "@/components/Header";
import { Pitch } from "@/components/pitch/Pitch";
import { AlertsCard } from "@/components/panel/AlertsCard";
import { VerdictBar } from "@/components/panel/VerdictBar";
import { PlayerDialogProvider } from "@/components/panel/PlayerDialog";
import { FullBreakdown } from "@/components/panel/FullBreakdown";
import { AskTheScout } from "@/components/panel/AskTheScout";
import { Skeleton } from "@/components/states/Skeleton";
import { ErrorCard } from "@/components/states/ErrorCard";
import type { AskMessage } from "@/lib/client/ask";

type Status = "idle" | "loading" | "loaded" | "error";
type Lens = "this-week" | "long-term" | "chips";

const LS_ID = "fpl:lastId";
const LS_FT = "fpl:ft";

export default function Home() {
  const [managerId, setManagerId] = useState("");
  const [freeTransfers, setFreeTransfers] = useState(1);
  // The FT value the displayed plan was actually computed with. The toggle moves
  // `freeTransfers` (the selection); `appliedFt` only changes when an analysis runs.
  const [appliedFt, setAppliedFt] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [plan, setPlan] = useState<GameweekPlan | null>(null);
  const [error, setError] = useState("");
  const [lens, setLens] = useState<Lens>("this-week");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [chat, setChat] = useState<AskMessage[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  // Bumped once per completed analysis — signals the chat to fire its opening brief.
  const [briefNonce, setBriefNonce] = useState(0);

  const load = useCallback(async (id: string, ft: number, opts: { force?: boolean } = {}) => {
    setManagerId(id);
    setFreeTransfers(ft);
    setAppliedFt(ft); // this analysis is the new applied baseline → clears any pending state
    setStatus("loading");
    setError("");
    setChat([]); // new analysis → fresh conversation (grounding context changed)
    setBreakdownOpen(false); // every load leads with the conversation; breakdown starts collapsed
    setInsightsLoading(false);
    try {
      // Phase 1 — paint the pitch immediately from the deterministic base.
      const base = await fetchPlanBase(id, ft);
      setPlan(base);
      setStatus("loaded");
      setInsightsLoading(true);

      // Phase 2 — fill in the LLM-derived verdict/detail when it arrives.
      try {
        const insights = await fetchPlanInsights(id, ft, { force: opts.force });
        setPlan((prev) => {
          if (!prev) return prev;
          const capId = insights.captaincy?.captain.player.player.id ?? null;
          const viceId = insights.captaincy?.viceCaptain?.player.player.id ?? null;
          // Reconcile the armband with the (possibly LLM-refined) captaincy.
          const squad =
            capId == null
              ? prev.squad
              : prev.squad.map((s) => ({
                  ...s,
                  isCaptainRec: s.id === capId,
                  isViceRec: s.id === viceId,
                }));
          return { ...prev, ...insights, squad };
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't load the Scout's analysis.";
        setPlan((prev) => (prev ? { ...prev, alerts: [...prev.alerts, msg] } : prev));
      } finally {
        setInsightsLoading(false);
        setBriefNonce((n) => n + 1); // insights ready (or failed) → let the Scout open with its brief
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  // Recall last session and auto-load. Reading localStorage + kicking off the
  // fetch is a legitimate mount-time sync with an external system (the one
  // idle→loading transition here is intentional, not a cascading render).
  useEffect(() => {
    const savedId = localStorage.getItem(LS_ID) ?? "";
    const savedFt = Number(localStorage.getItem(LS_FT)) || 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedId) load(savedId, savedFt);
  }, [load]);

  const handleSubmit = (id: string, ft: number) => {
    localStorage.setItem(LS_ID, id);
    localStorage.setItem(LS_FT, String(ft));
    load(id, ft);
  };

  // The toggle only updates the selection (persisted). Analysis re-runs on
  // Re-analyze, which reads this value — never automatically here.
  const handleFreeTransfers = (n: number) => {
    localStorage.setItem(LS_FT, String(n));
    setFreeTransfers(n);
  };

  const changeManager = () => {
    setStatus("idle");
    setPlan(null);
  };

  if (status === "idle") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <ManagerIdForm
          initialId={managerId}
          initialFreeTransfers={freeTransfers}
          onSubmit={handleSubmit}
        />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <ErrorCard message={error} onRetry={changeManager} />
      </main>
    );
  }

  if (status === "loading" || !plan) {
    return (
      <main className="flex-1">
        <Skeleton />
      </main>
    );
  }

  const transferOutIds = new Set(
    plan.transfers?.primaryRecommendation.transfers.map((t) => t.weakPlayer.player.id) ?? []
  );

  // Selection changed but not yet analyzed → Re-analyze is pending.
  const ftPending = freeTransfers !== appliedFt;

  return (
    <PlayerDialogProvider>
    <main className="flex flex-1 flex-col">
      <Header
        plan={plan}
        freeTransfers={freeTransfers}
        onFreeTransfersChange={handleFreeTransfers}
        onReanalyze={() => load(managerId, freeTransfers, { force: true })}
        onChangeManager={changeManager}
        busy={insightsLoading}
        dirty={ftPending}
      />
      {/* Glanceable verdict — full-width, above the fold, spanning both columns */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <VerdictBar plan={plan} loading={insightsLoading} />
      </div>

      {/* 2×2 lens — row 1: pitch | conversation (stretched to the pitch's height);
          row 2: collapsible This Week + Long Term plan | alerts. */}
      <div className="mx-auto grid w-full max-w-6xl items-start gap-4 px-4 py-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Row 1 left — the pitch sets the row height */}
        <Pitch squad={plan.squad} transferOutIds={transferOutIds} />

        {/* Row 1 right — hero conversation. The wrapper stretches to the pitch's
            height; the panel fills it via absolute inset-0 so its own message list
            can't grow the grid row (the chat scrolls inside instead). On mobile the
            wrapper is a normal block and the panel takes its own fixed height. */}
        <div className="lg:relative lg:self-stretch">
          <AskTheScout
            className="lg:absolute lg:inset-0"
            teamId={Number(managerId)}
            freeTransfers={appliedFt}
            plan={plan}
            briefNonce={briefNonce}
            messages={chat}
            onMessagesChange={setChat}
          />
        </div>

        {/* Row 2 left — the collapsible This Week + Long Term plan */}
        <FullBreakdown
          open={breakdownOpen}
          onToggle={() => setBreakdownOpen((o) => !o)}
          lens={lens}
          onLensChange={setLens}
          plan={plan}
          loading={insightsLoading}
        />

        {/* Row 2 right — alerts, under the conversation */}
        <AlertsCard plan={plan} />
      </div>
    </main>
    </PlayerDialogProvider>
  );
}
