// Markdown renderer for agent replies, matching the house style in server/agents.js:
// "### " headline, "> " summary callout, "#### " sections (Next steps gets an accent), tables,
// nested bullet / numbered lists, paragraphs, bold/italic/code and [label](url) links.
// Text is HTML-escaped before any formatting is applied, so model output cannot inject markup;
// links are only emitted for http(s) URLs.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s: string) =>
  esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s.,)]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])\*([^*]+?)\*(?=[\s.,)]|$)/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

const isRow = (l: string) => /^\s*\|/.test(l);
const isList = (l: string) => /^\s*([-*•]|\d+[.)])\s/.test(l);
const isQuote = (l: string) => /^\s*>/.test(l);

const bullet = /^\s*([-*•]|\d+[.)])\s/;
const plain = (s: string) => s.replace(bullet, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();

function list(lines: string[]) {
  // Indentation of 2+ spaces nests one level; ordered vs unordered follows the first item of each level.
  let out = '';
  const stack: string[] = [];
  for (const line of lines) {
    const depth = Math.min(3, Math.floor(line.match(/^\s*/)![0].length / 2));
    const tag = /^\s*\d+[.)]/.test(line) ? 'ol' : 'ul';
    while (stack.length > depth + 1) out += `</${stack.pop()}>`;
    while (stack.length < depth + 1) { stack.push(tag); out += `<${tag}>`; }
    out += `<li>${inline(line.replace(bullet, ''))}</li>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

// "Next steps" items become buttons; Workspace sends a clicked step's data-step text to the agent.
const steps = (lines: string[]) =>
  '<div class="md-steps">' + lines.filter((l) => !/^\s{2,}/.test(l)).map((l) =>
    `<button type="button" class="md-step" data-step="${esc(plain(l))}"><span>${inline(l.replace(bullet, ''))}</span><span class="md-step-go">Ask</span></button>`).join('') + '</div>';

export function toHtml(text: string) {
  const lines = text.replace(/\r/g, '').split('\n');
  let out = '';
  let i = 0;
  let nextSteps = false; // true right after a "Next steps" heading
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() && !isList(l) && !/^#{4,6}\s/.test(l)) nextSteps = false;
    if (isList(l) && nextSteps) {
      const block: string[] = [];
      while (i < lines.length && (isList(lines[i]) || /^\s{2,}\S/.test(lines[i]))) block.push(lines[i++]);
      out += steps(block);
      nextSteps = false;
      continue;
    }
    if (isRow(l)) {
      const rows: string[][] = [];
      while (i < lines.length && isRow(lines[i])) rows.push(lines[i++].trim().replace(/^\||\|$/g, '').split('|'));
      const body = rows.filter((r, n) => !(n === 1 && r.every((c) => /^\s*:?-+:?\s*$/.test(c))));
      const [head, ...data] = body;
      out += '<div class="md-table"><table><thead><tr>' + head.map((c) => `<th>${inline(c.trim())}</th>`).join('') + '</tr></thead><tbody>'
        + data.map((r) => '<tr>' + r.map((c) => `<td>${inline(c.trim())}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    } else if (isList(l)) {
      const block: string[] = [];
      while (i < lines.length && (isList(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length))) block.push(lines[i++]);
      out += list(block);
    } else if (isQuote(l)) {
      const block: string[] = [];
      while (i < lines.length && isQuote(lines[i])) block.push(lines[i++].replace(/^\s*>\s?/, ''));
      out += `<div class="md-callout">${block.filter(Boolean).map((b) => `<p>${inline(b)}</p>`).join('')}</div>`;
    } else if (/^#{1,3}\s/.test(l)) {
      out += `<h3>${inline(l.replace(/^#+\s/, ''))}</h3>`;
      i++;
    } else if (/^#{4,6}\s/.test(l)) {
      const title = l.replace(/^#+\s/, '');
      const isNext = /next steps|recommended actions|actions/i.test(title);
      out += `<h4${isNext ? ' class="md-next"' : ''}>${inline(title)}</h4>`;
      nextSteps = isNext;
      i++;
      continue;
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) {
      out += '<hr/>';
      i++;
    } else if (!l.trim()) {
      i++;
    } else {
      out += `<p>${inline(l)}</p>`;
      i++;
    }
  }
  return out;
}

export const Markdown = ({ text }: { text: string }) => (
  <div className="md" dangerouslySetInnerHTML={{ __html: toHtml(text) }} />
);
