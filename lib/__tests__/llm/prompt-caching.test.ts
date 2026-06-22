import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { withCachedSystem, withCachedTail } from "../../llm/client";

describe("withCachedSystem", () => {
  it("wraps the system string in one ephemeral-cached text block", () => {
    const blocks = withCachedSystem("You are the Scout.");
    expect(blocks).toEqual([
      { type: "text", text: "You are the Scout.", cache_control: { type: "ephemeral" } },
    ]);
  });
});

describe("withCachedTail", () => {
  it("marks the last block of a string-content message (converting to a text block)", () => {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Who do I captain?" }];
    const out = withCachedTail(messages);
    expect(out[0].content).toEqual([
      { type: "text", text: "Who do I captain?", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("marks only the last block of an array-content message", () => {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "a", content: "first" },
          { type: "tool_result", tool_use_id: "b", content: "second" },
        ],
      },
    ];
    const out = withCachedTail(messages);
    const blocks = out[0].content as Anthropic.ContentBlockParam[];
    expect(blocks[0]).not.toHaveProperty("cache_control");
    expect(blocks[1]).toMatchObject({ cache_control: { type: "ephemeral" } });
  });

  it("marks the tail of the LAST message only", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "captain?" },
    ];
    const out = withCachedTail(messages);
    expect(out[0].content).toBe("hi"); // earlier turns untouched
    expect(out[1].content).toBe("hello");
    expect(out[2].content).toEqual([
      { type: "text", text: "captain?", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("does not mutate the input array or its messages", () => {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: "stay clean" }];
    withCachedTail(messages);
    expect(messages[0].content).toBe("stay clean"); // original left appendable/clean
  });

  it("returns empty input unchanged", () => {
    const messages: Anthropic.MessageParam[] = [];
    expect(withCachedTail(messages)).toBe(messages);
  });
});
