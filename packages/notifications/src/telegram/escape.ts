/**
 * Telegram Bot API HTML parse_mode escaping.
 * Only `<`, `>`, `&` need to be escaped per
 * https://core.telegram.org/bots/api#html-style
 */
export function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Bold via <b>…</b>; input is escaped first. */
export function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`
}

/** Italic via <i>…</i>; input is escaped first. */
export function italic(text: string): string {
  return `<i>${escapeHtml(text)}</i>`
}

/** Inline code via <code>…</code>; input is escaped first. */
export function code(text: string): string {
  return `<code>${escapeHtml(text)}</code>`
}

/**
 * Link. URL is NOT escaped here (Telegram expects raw URL in href);
 * callers should pass URLs that have been validated/sanitized upstream.
 */
export function link(label: string, url: string): string {
  return `<a href="${url}">${escapeHtml(label)}</a>`
}
