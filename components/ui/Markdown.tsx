import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Compact, dark-bubble component map for the Scout's chat replies. The system
// prompt steers the model to prose + short bullets (no tables), but the renderer
// degrades any stray GFM gracefully rather than showing raw markup.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-fpl-cyan underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  h1: ({ children }) => <p className="mb-1 font-semibold text-foreground">{children}</p>,
  h2: ({ children }) => <p className="mb-1 font-semibold text-foreground">{children}</p>,
  h3: ({ children }) => <p className="mb-1 font-semibold text-foreground">{children}</p>,
  // Compact table rendering for the rare case the model emits one anyway.
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-1.5 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-1.5 py-1">{children}</td>,
};

/** Renders a constrained Markdown subset for chat bubbles. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}
