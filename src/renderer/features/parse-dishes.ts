// Pure parser for the bulk-add feature: turns pasted lines into dish fields.
// No DOM or store imports, so it is trivially unit-testable.

export interface ParsedDish {
  name: string;
  desc: string;
  price: string;
}

/**
 * Parse pasted lines into dishes. One dish per line; fields split by "|", or a
 * spaced dash, or a tab. Examples that all work:
 *   Heritage Tomato | basil, aged balsamic | 9
 *   Roast Cod - brown shrimp butter - 24
 *   Sticky Toffee
 * A trailing number is treated as the price even without a separator before it
 * (unless the number is the entire remaining field).
 */
export function parseDishLines(text: string): ParsedDish[] {
  const out: ParsedDish[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let parts: string[];
    if (line.includes('|')) parts = line.split('|');
    else if (line.includes('\t')) parts = line.split('\t');
    else parts = line.split(/\s+[–—-]\s+/); // spaced hyphen/en-dash/em-dash only, so "brown-shrimp" survives
    parts = parts.map((p) => p.trim());
    let [name = '', desc = '', price = ''] = parts;
    if (!price) {
      const host = desc || name;
      const m = host.match(/\s+[£$€]?\s*(\d+(?:\.\d{1,2})?)\s*$/); // needs whitespace before the price
      if (m) {
        price = m[1];
        const trimmed = host.slice(0, m.index).trim();
        if (desc) desc = trimmed;
        else name = trimmed;
      }
    }
    if (!name && !desc) continue;
    out.push({ name, desc, price: price.replace(/^[£$€]\s*/, '') });
  }
  return out;
}
