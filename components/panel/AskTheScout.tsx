"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { streamAsk, type AskMessage } from "@/lib/client/ask";
import { streamBrief } from "@/lib/client/brief";
import { buildScoutStarters } from "@/lib/client/scoutStarters";
import type { GameweekPlan } from "@/lib/plan/types";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  get_plan: "Reviewing your gameweek plan…",
  get_squad: "Checking your squad…",
  score_player: "Scoring a player…",
  search_players: "Searching for options…",
  compare_players: "Comparing players…",
  simulate_transfer: "Simulating a transfer…",
  simulate_captain: "Simulating captaincy…",
};

// Rotating placeholders while the Scout is thinking — the opening brief gets
// squad-flavoured copy; a follow-up reply gets generic working copy.
const BRIEF_PHRASES = [
  "Scout is analyzing your squad…",
  "Reviewing your fixtures…",
  "Weighing your transfer options…",
  "Sizing up the captaincy call…",
  "Preparing your weekly brief…",
];
const REPLY_PHRASES = ["Thinking…", "Consulting your squad…", "Crunching the numbers…"];

function ThinkingIndicator({ phrases }: { phrases: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, []);
  const idx = i % phrases.length; // guard against a phrase-list swap (brief → reply)
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      <span key={idx} className="animate-in fade-in duration-700">
        {phrases[idx]}
      </span>
    </div>
  );
}

export function AskTheScout({
  teamId,
  freeTransfers,
  plan,
  briefNonce,
  messages,
  onMessagesChange,
  className,
}: {
  teamId: number;
  freeTransfers: number;
  plan: GameweekPlan;
  /** Bumped by the page once per fresh analysis — triggers the proactive brief. */
  briefNonce: number;
  messages: AskMessage[];
  onMessagesChange: (messages: AskMessage[]) => void;
  className?: string;
}) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firedNonceRef = useRef(0);

  // Keep the latest message / streamed token in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, activeTool]);

  // The Scout opens the conversation: when a fresh analysis is ready (briefNonce
  // bumps), stream the opening brief into the first assistant bubble — exactly
  // once per analysis, and never on top of an existing conversation.
  const fireBrief = useCallback(async () => {
    setStreaming(true);
    setStreamingText("");
    setActiveTool(null);

    let errorMsg: string | null = null;
    const text = await streamBrief(
      { teamId, freeTransfers },
      {
        onToken: (t) => setStreamingText((prev) => prev + t),
        onError: (m) => {
          errorMsg = m;
        },
      }
    );

    const finalText = text || errorMsg || "I'm ready when you are — ask me anything about your squad.";
    onMessagesChange([{ role: "assistant", content: finalText }]);
    setStreaming(false);
    setStreamingText("");
  }, [teamId, freeTransfers, onMessagesChange]);

  useEffect(() => {
    if (briefNonce === 0 || firedNonceRef.current === briefNonce) return;
    firedNonceRef.current = briefNonce; // claim this analysis so it fires only once
    if (messages.length > 0) return; // user already started chatting — don't inject the brief
    // Kick off the proactive brief. This is a legitimate effect→external-system
    // sync (start streaming from /api/brief); the setState begins the stream UI,
    // not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fireBrief();
  }, [briefNonce, messages.length, fireBrief]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const next: AskMessage[] = [...messages, { role: "user", content: question }];
    onMessagesChange(next);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setActiveTool(null);

    // Ground chip answers in the committed plan the panels show (drop the draft).
    const chipPlan = plan.transfers?.chipPlan?.map(({ chip, status, triggerGw, reason }) => ({
      chip,
      status,
      triggerGw,
      reason,
    }));

    let errorMsg: string | null = null;
    const answer = await streamAsk(
      { teamId, freeTransfers, messages: next, chipPlan },
      {
        onToken: (t) => setStreamingText((prev) => prev + t),
        // A tool call means the prior text was just preamble — clear it so the
        // committed answer is only the final post-tool response.
        onTool: (name) => {
          setActiveTool(name);
          setStreamingText("");
        },
        onError: (m) => {
          errorMsg = m;
        },
      }
    );

    const finalText = answer || errorMsg || "(The Scout had nothing to add.)";
    onMessagesChange([...next, { role: "assistant", content: finalText }]);
    setStreaming(false);
    setStreamingText("");
    setActiveTool(null);
  }

  const starters = buildScoutStarters(plan);
  // Show starter chips until the manager asks their first question — both before
  // the brief (empty) and as follow-ups beneath it.
  const showStarters = !streaming && !messages.some((m) => m.role === "user");

  return (
    <div className={cn("flex h-[32rem] flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-auto", className)}>

      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3.5 text-fpl-green" />
        Ask The Scout
      </div>

      {/* Message list */}
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with the Scout"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-muted-foreground">
            Ask about transfers, captaincy, chips or any player — grounded in your squad and the live
            data.
          </p>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}

        {/* Contextual starters — the Scout's invitation to dig in (hidden once the
            manager asks something or while a reply streams). */}
        {showStarters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-fpl-green hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* In-flight assistant reply */}
        {streaming && (
          <div className="flex flex-col items-start gap-1.5">
            {activeTool && (
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {TOOL_LABELS[activeTool] ?? "Working…"}
              </div>
            )}
            {streamingText ? (
              <Bubble role="assistant" text={streamingText} streaming />
            ) : (
              !activeTool && (
                <ThinkingIndicator
                  phrases={messages.length === 0 ? BRIEF_PHRASES : REPLY_PHRASES}
                />
              )
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          aria-label="Ask the Scout a question"
          placeholder="Ask the Scout…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-fpl-green disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-fpl-green text-fpl-purple transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          // User bubble uses the brighter brand purple so the manager's own
          // message reads distinctly against the card (#2d0032); white text on
          // #963cff clears WCAG AA. Assistant stays on muted.
          isUser ? "whitespace-pre-wrap bg-fpl-light-purple text-white" : "bg-muted text-foreground"
        )}
      >
        {/* User text is shown verbatim; the Scout's reply renders Markdown. */}
        {isUser ? text : <Markdown>{text}</Markdown>}
        {streaming && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
      </div>
    </div>
  );
}
