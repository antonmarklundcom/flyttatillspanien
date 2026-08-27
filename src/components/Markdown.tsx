import Link from "next/link";
import { Fragment } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

/**
 * Renders a post body. The parser hands back a typed tree and this turns it
 * into React elements — no dangerouslySetInnerHTML, so nothing an author (or
 * anything that ever reaches the posts table) types can become markup.
 */
function InlineRun({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case "bold":
            return <strong key={i}>{part.value}</strong>;
          case "italic":
            return <em key={i}>{part.value}</em>;
          case "link":
            return part.href.startsWith("/") ? (
              <Link key={i} href={part.href}>
                {part.value}
              </Link>
            ) : (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {part.value}
              </a>
            );
          default:
            return <Fragment key={i}>{part.value}</Fragment>;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      return block.level === 2 ? (
        <h2>
          <InlineRun parts={block.content} />
        </h2>
      ) : (
        <h3>
          <InlineRun parts={block.content} />
        </h3>
      );
    case "paragraph":
      return (
        <p>
          <InlineRun parts={block.content} />
        </p>
      );
    case "list":
      return block.ordered ? (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineRun parts={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineRun parts={item} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="post-quote">
          <InlineRun parts={block.content} />
        </blockquote>
      );
    case "divider":
      return <hr className="post-divider" />;
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="mk-prose post-body">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
