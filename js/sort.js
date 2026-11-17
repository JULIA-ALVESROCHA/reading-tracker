// Sorting with missing values always last (FR-05), then by ID ascending.

import { compareText } from "./ui.js";

function isMissing(value) {
  return value == null || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/**
 * Sorts a copy of rows.
 * @param key property to sort by
 * @param dir "asc" | "desc"
 * @param rank optional function value -> number, for values with a custom order (e.g. status)
 */
export function sortRows(rows, key, dir, rank = null) {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    const ma = isMissing(va);
    const mb = isMissing(vb);
    if (ma && !mb) return 1; // missing sorts after filled, in both directions
    if (!ma && mb) return -1;
    if (!ma && !mb) {
      let cmp;
      if (rank) cmp = rank(va) - rank(vb);
      else if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = compareText(va, vb);
      if (cmp !== 0) return sign * cmp;
    }
    return a.id - b.id;
  });
}

/** Next sort state when a column header is clicked. */
export function nextSort(current, key, defaultDir = "asc") {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: defaultDir };
}
