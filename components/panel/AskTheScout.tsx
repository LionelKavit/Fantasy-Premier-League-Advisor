"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { streamAsk, type AskMessage } from "@/lib/client/ask";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Who should I captain this week?",
  "What's my best transfer right now?",
  "Should I take a -4 hit?",
  "Which of my players are at risk?",
];

const TOOL_LABELS: Record<string, string> = {
  get_plan: "Reviewing your gameweek plan…",
  get_squad: "Checking your squad…",
  score_player: "Scoring a player…",
  search_players: "Searching for options…",
  compare_players: "Comparing players…",
  simulate_transfer: "Simulating a transfer…",
  simulate_captain: "Simulating captaincy…",
};

export function AskTheScout({
  teamId,
  freeTransfers,
  messages,
  onMessagesChange,
}: {
  teamId: number;
  freeTransfers: number;
  messages: AskMessage[];
  onMessagesChange: (messages: AskMessage[]) => void;
}) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the latest message / streamed token in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, activeTool]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const next: AskMessage[] = [...messages, { role: "user", content: question }];
    onMessagesChange(next);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setActiveTool(null);

    let errorMsg: string | null = null;
    const answer = await streamAsk(
      { teamId, freeTransfers, messages: next },
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

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[34rem] flex-col rounded-lg border border-border bg-card">
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
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {isEmpty && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask about transfers, captaincy, chips or any player — grounded in your squad and the
              live data.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-fpl-green hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}

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
                <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Thinking…
                </div>
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
