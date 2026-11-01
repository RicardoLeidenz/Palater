/**
 * Mirrors the database's normalize_name(): lowercase, strip accents and
 * punctuation, collapse whitespace. "Crème Brûlée!" → "creme brulee".
 */
export function normalizeName(s: string) {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string) {
  const padded = ` ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Dice coefficient over character bigrams of normalized names, 0–1. */
export function nameSimilarity(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let overlap = 0;
  let total = 0;
  for (const [g, n] of ga) {
    overlap += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  return (2 * overlap) / total;
}
