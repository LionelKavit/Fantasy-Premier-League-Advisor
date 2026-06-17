"use client";

import { useEffect, useState, useCallback } from "react";
import type { GameweekPlan } from "@/lib/plan/types";
import { fetchPlan } from "@/lib/client/plan";
import { ManagerIdForm } from "@/components/ManagerIdForm";
import { Header } from "@/components/Header";
import { Pitch } from "@/components/pitch/Pitch";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { Skeleton } from "@/components/states/Skeleton";
import { ErrorCard } from "@/components/states/ErrorCard";

type Status = "idle" | "loading" | "loaded" | "error";
const LS_ID = "fpl:lastId";
const LS_FT = "fpl:ft";

export default function Home() {
  const [managerId, setManagerId] = useState("");
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [plan, setPlan] = useState<GameweekPlan | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (id: string, ft: number) => {
    setManagerId(id);
    setFreeTransfers(ft);
    setStatus("loading");
    setError("");
    try {
      const result = await fetchPlan(id, ft);
      setPlan(result);
      setStatus("loaded");
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
        onReanalyze={() => load(managerId, freeTransfers)}
        onChangeManager={changeManager}
        busy={false}
      />
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <Pitch squad={plan.squad} transferOutIds={transferOutIds} />
        <RecommendationPanel plan={plan} />
      </div>
    </main>
  );
}
