// Single source of truth for HTML-escaping interpolated strings in template
// literals. Previously duplicated as a local `esc()` in a dozen modules.

const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string | undefined | null): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c] as string);
}
