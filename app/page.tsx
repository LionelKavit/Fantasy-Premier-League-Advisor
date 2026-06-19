"use client";

import { useEffect, useState, useCallback } from "react";
import type { GameweekPlan } from "@/lib/plan/types";
import { fetchPlanBase, fetchPlanInsights } from "@/lib/client/plan";
import { ManagerIdForm } from "@/components/ManagerIdForm";
import { Header } from "@/components/Header";
import { Pitch } from "@/components/pitch/Pitch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoutVerdict } from "@/components/panel/ScoutVerdict";
import { AlertsCard } from "@/components/panel/AlertsCard";
import { ThisWeekDetail } from "@/components/panel/ThisWeekDetail";
import { LongTermDetail } from "@/components/panel/LongTermDetail";
import { AskTheScout } from "@/components/panel/AskTheScout";
import { Skeleton } from "@/components/states/Skeleton";
import { AnalyzingIndicator } from "@/components/states/AnalyzingIndicator";
import { ErrorCard } from "@/components/states/ErrorCard";
import type { AskMessage } from "@/lib/client/ask";

type Status = "idle" | "loading" | "loaded" | "error";
type Lens = "this-week" | "long-term" | "ask";

const tabTrigger =
  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground data-[selected]:bg-fpl-green data-[selected]:text-fpl-purple disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground";
const LS_ID = "fpl:lastId";
const LS_FT = "fpl:ft";

export default function Home() {
  const [managerId, setManagerId] = useState("");
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [plan, setPlan] = useState<GameweekPlan | null>(null);
  const [error, setError] = useState("");
  const [lens, setLens] = useState<Lens>("this-week");
  const [chat, setChat] = useState<AskMessage[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const load = useCallback(async (id: string, ft: number, opts: { force?: boolean } = {}) => {
    setManagerId(id);
    setFreeTransfers(ft);
    setStatus("loading");
    setError("");
    setChat([]); // new analysis → fresh conversation (grounding context changed)
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

  const handleFreeTransfers = (n: number) => {
    localStorage.setItem(LS_FT, String(n));
    if (managerId) load(managerId, n);
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

  return (
    <main className="flex flex-1 flex-col">
      <Header
        plan={plan}
        freeTransfers={freeTransfers}
        onFreeTransfersChange={handleFreeTransfers}
        onReanalyze={() => load(managerId, freeTransfers, { force: true })}
        onChangeManager={changeManager}
        busy={insightsLoading}
      />
      <div className="mx-auto grid w-full max-w-6xl items-start gap-4 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: pitch + tab-aware prose + pinned alerts */}
        <div className="flex flex-col gap-4">
          <Pitch squad={plan.squad} transferOutIds={transferOutIds} />
          <ScoutVerdict
            plan={plan}
            tab={lens === "long-term" ? "long-term" : "this-week"}
            loading={insightsLoading}
          />
          <AlertsCard plan={plan} />
        </div>

        {/* Right: tab bar + structured detail (the lens drives both columns) */}
        <div className="flex flex-col gap-3">
          <Tabs value={lens} onValueChange={(v) => setLens(v as Lens)}>
            <TabsList
              aria-label="Strategy views"
              className="flex gap-1 rounded-lg border border-border bg-card p-1"
            >
              <TabsTrigger value="this-week" className={tabTrigger}>
                This Week
              </TabsTrigger>
              <TabsTrigger value="long-term" className={tabTrigger}>
                Long Term
              </TabsTrigger>
              <TabsTrigger value="ask" className={tabTrigger}>
                Ask The Scout
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {lens === "ask" ? (
            <AskTheScout
              teamId={Number(managerId)}
              freeTransfers={freeTransfers}
              messages={chat}
              onMessagesChange={setChat}
            />
          ) : insightsLoading ? (
            <AnalyzingIndicator />
          ) : lens === "this-week" ? (
            <ThisWeekDetail plan={plan} />
          ) : (
            <LongTermDetail plan={plan} />
          )}
        </div>
      </div>
    </main>
  );
}
