// Safe Markdown renderer for magazine articles (Nov 2026).
//
// Articles are written by admins only, but the renderer still escapes
// all HTML first and only allows safe URLs, so a pasted embed or a
// stray tag can never inject markup into the page. Supported subset:
// headings (#, ##, ###), bold, italic, inline code, links, images,
// unordered and ordered lists, blockquotes, horizontal rules and
// paragraphs. Anything else renders as plain text.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // Images: ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, url: string) => {
    const safe = safeUrl(url);
    if (!safe) return alt;
    return `<img src="${safe}" alt="${alt}" loading="lazy" />`;
  });
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Bold and italic (bold first so ** does not become two italics).
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Inline code.
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  const flushList = (items: string[], ordered: boolean) => {
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>` + items.map((item) => `<li>${renderInline(item)}</li>`).join("") + `</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      html.push("<hr />");
      i += 1;
      continue;
    }
    // Headings.
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }
    // Blockquote (consecutive > lines form one quote).
    if (trimmed.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${parts.map((p) => renderInline(p)).join("<br />")}</blockquote>`);
      continue;
    }
    // Lists (consecutive items of the same kind form one list).
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const u = t.match(/^[-*]\s+(.+)$/);
        const o = t.match(/^\d+[.)]\s+(.+)$/);
        if (isOrdered ? o : u) {
          items.push((isOrdered ? o![1] : u![1]).trim());
          i += 1;
        } else {
          break;
        }
      }
      flushList(items, isOrdered);
      continue;
    }
    // A lone image line becomes a figure with its alt text as caption.
    const imageOnly = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageOnly) {
      const safe = safeUrl(imageOnly[2]);
      if (safe) {
        const caption = escapeHtml(imageOnly[1].trim());
        html.push(
          `<figure><img src="${safe}" alt="${imageOnly[1]}" loading="lazy" />${
            caption ? `<figcaption>${caption}</figcaption>` : ""
          }</figure>`,
        );
      }
      i += 1;
      continue;
    }
    // Paragraph: consecutive non-blank lines that are not another block.
    const parts: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (
        /^(#{1,3})\s/.test(next) ||
        next.startsWith(">") ||
        /^[-*]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next)
      ) {
        break;
      }
      parts.push(next);
      i += 1;
    }
    html.push(`<p>${parts.map((p) => renderInline(p)).join("<br />")}</p>`);
  }
  return html.join("\n");
}
