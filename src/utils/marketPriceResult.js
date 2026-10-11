/** Generic case-insensitive API commodity comparison. */
export function normalizeCommodityName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function commodityNamesMatch(recordName, searchName) {
  return normalizeCommodityName(recordName) === normalizeCommodityName(searchName);
}

/** Keep live API results ahead of stored and local demo records. */
export function prioritizeMarketPriceResults({ live, stored, demo }) {
  if (live && !live.error && live.rows?.length) {
    return { rows: live.rows, error: null, sourceType: "live-api" };
  }
  if (stored && stored.rows?.length) {
    return { rows: stored.rows, error: null, sourceType: "supabase" };
  }
  if (demo && demo.rows?.length) {
    return { rows: demo.rows, error: null, sourceType: "demo" };
  }
  return {
    rows: [],
    error: stored?.error || live?.error || null,
    sourceType: stored ? "supabase" : live ? "live-api" : demo ? "demo" : null,
  };
}
