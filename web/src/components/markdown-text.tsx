import { createContext, useContext, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { parseMarkdown, type MdBlock, type MdSpan } from "@/lib/markdown";
import { splitHighlight } from "@/lib/transcript-search";

// Renders the Markdown AST as React elements. Every string from the log reaches the DOM as a TEXT
// NODE — there is no `dangerouslySetInnerHTML` here and there must never be one. That is the repo's
// XSS boundary (CLAUDE.md §"Security posture"): the parser decides *structure*, never markup, so a
// transcript containing `<script>` renders those characters and nothing executes.
//
// Sizing/colour deliberately track the surrounding transcript styles rather than introducing a
// prose theme — this is a reading view inside a terminal-ish app, not a document viewer.

// The active find query, threaded via context rather than a prop drilled through every nested span —
// highlighting is a cross-cutting display concern, and the AST walk is already recursive.
const QueryContext = createContext("");

/** Literal text with find hits marked. Still text nodes — `<mark>` is structure, never parsed markup. */
function Hit({ text }: { text: string }) {
  const query = useContext(QueryContext);
  if (query.trim() === "") return <>{text}</>;
  const pieces = splitHighlight(text, query);
  if (pieces.length === 1 && !pieces[0]!.hit) return <>{text}</>;
  return (
    <>
      {pieces.map((piece, i) =>
        piece.hit ? (
          <mark key={i} className="rounded-sm bg-amber-300/70 text-inherit dark:bg-amber-500/40">
            {piece.text}
          </mark>
        ) : (
          <span key={i}>{piece.text}</span>
        ),
      )}
    </>
  );
}

// Emphasis and links hold child spans (agents nest them — ``**`sha`**`` is routine), so this recurses
// through <Spans>. `code` is the leaf.
function Span({ span }: { span: MdSpan }) {
  switch (span.kind) {
    case "bold":
      return (
        <strong className="font-semibold">
          <Spans spans={span.spans} />
        </strong>
      );
    case "italic":
      return (
        <em className="italic">
          <Spans spans={span.spans} />
        </em>
      );
    case "strike":
      return (
        <del className="text-muted-foreground">
          <Spans spans={span.spans} />
        </del>
      );
    case "code":
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] break-all">
          <Hit text={span.text} />
        </code>
      );
    case "link":
      // `href` was scheme-checked in the parser. noreferrer/noopener because these URLs come from
      // agent output, and target=_blank keeps the PWA shell alive behind the tap.
      return (
        <a
          href={span.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
        >
          <Spans spans={span.spans} />
        </a>
      );
    default:
      return <Hit text={span.text} />;
  }
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permission is optional; the code remains readable when it is unavailable.
    }
  }

  return (
    <div className="overflow-hidden rounded-md border bg-muted/50">
      <div className="flex min-h-7 items-center justify-between border-b px-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{lang || t("transcript.codeBlock")}</span>
        <button
          type="button"
          onClick={copyCode}
          aria-label={copied ? t("transcript.codeCopied") : t("transcript.copyCode")}
          title={copied ? t("transcript.codeCopied") : t("transcript.copyCode")}
          className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-2 py-1.5 font-mono text-[11px] leading-snug">
        <Hit text={text} />
      </pre>
    </div>
  );
}

const Spans = ({ spans }: { spans: MdSpan[] }) => (
  <>
    {spans.map((span, i) => (
      <Span key={i} span={span} />
    ))}
  </>
);

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-semibold",
  2: "text-[0.95rem] font-semibold",
  3: "text-sm font-semibold",
};

const ALIGN_CLASS: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function Block({ block }: { block: MdBlock }) {
  const { t } = useTranslation();
  switch (block.kind) {
    case "heading": {
      // Levels 4-6 are rare in agent prose and don't earn another size step on a phone.
      const cls = HEADING_CLASS[block.level] ?? "text-sm font-semibold";
      return (
        <div className={`${cls} mt-1 leading-snug`}>
          <Spans spans={block.spans} />
        </div>
      );
    }
    case "code":
      return <CodeBlock lang={block.lang} text={block.text} />;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={`ml-4 space-y-0.5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground`}
        >
          {block.items.map((item, i) => (
            <li key={i} className={item.checked === undefined ? "pl-0.5" : "list-none"}>
              {item.checked !== undefined && (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  disabled
                  tabIndex={-1}
                  aria-label={item.checked ? t("transcript.completedTask") : t("transcript.openTask")}
                  className="mr-1.5 align-[-0.15em] accent-primary"
                />
              )}
              <Spans spans={item.spans} />
              {item.children?.map((child, childIndex) => (
                <div key={childIndex} className="mt-1">
                  <Block block={child} />
                </div>
              ))}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-2 pl-2.5 text-muted-foreground italic">
          <Spans spans={block.spans} />
        </blockquote>
      );
    case "table":
      // Columns can't be made to fit a phone, so the table keeps its real widths and pans inside its
      // own scroller — the same thing a mobile browser does with a table on any normal page.
      return (
        <div className="overflow-x-auto">
          <table className="w-max border-collapse text-xs">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th
                    key={i}
                    className={`border px-2 py-1 font-semibold ${ALIGN_CLASS[block.align[i] ?? "left"]}`}
                  >
                    <Spans spans={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={`border px-2 py-1 align-top ${ALIGN_CLASS[block.align[c] ?? "left"]}`}
                    >
                      <Spans spans={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "rule":
      return <hr className="border-border" />;
    default:
      return (
        <p className="leading-relaxed">
          <Spans spans={block.spans} />
        </p>
      );
  }
}

/**
 * Render agent prose as formatted Markdown. Memoised on the source string: a transcript page holds
 * dozens of these and the parse is pure, so re-parsing on every unrelated re-render is pure waste.
 */
export function MarkdownText({
  text,
  className,
  query = "",
}: {
  text: string;
  className?: string;
  /** Active find query — occurrences render as marks. Empty disables highlighting entirely. */
  query?: string;
}) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <QueryContext.Provider value={query}>
      <div className={`space-y-2 text-sm break-words ${className ?? ""}`}>
        {blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </QueryContext.Provider>
  );
}
