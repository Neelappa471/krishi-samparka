import { supabase } from "../config/supabase";
import {
  MANDI_COMMODITY_ALIASES,
  normalizeReferenceKey,
} from "../data/mandiReference";
import {
  commodityNamesMatch,
  mapFallbackCropPriceRows,
  prioritizeMarketPriceResults,
} from "./marketPriceResult";

// Honest source label for everything that comes from the live Mandi Price API.
export const MARKET_PRICE_SOURCE_LABEL =
  "Government of India / data.gov.in via Mandi Price API";

// Base URL of the Mandi Price API. Override with VITE_MANDI_API_BASE in .env
// (for example if the API is moved to another host). No API key is needed.
export const MANDI_API_BASE = String(
  (import.meta.env && import.meta.env.VITE_MANDI_API_BASE) ||
    "https://mandi-api.onrender.com"
).replace(/\/+$/, "");

// Freshness buckets (by the mandi ARRIVAL date, never the fetch date):
//   0-7 days   -> "recent"      (the only data a Current Opportunity may use)
//   8-30 days  -> "older"
//   over 30    -> "historical"
// Records of every age are shown; only the labels and the opportunity rules
// depend on age.
export const MANDI_RECENT_DAYS = 7;
export const MANDI_OLDER_DAYS = 30;
export const MANDI_MAX_AGE_DAYS = MANDI_RECENT_DAYS; // kept for compatibility

// Free-tier hosts can take a while to wake up, so the timeout is generous.
const LIVE_TIMEOUT_MS = 20000;
const LIVE_CACHE_MS = 5 * 60 * 1000;

/** Karnataka districts prioritized for coastal / DK region farmers.
 *  "Bengaluru" (not "Bengaluru Urban") is the name the Mandi API uses. */
export const KARNATAKA_DISTRICTS = [
  "Udupi",
  "Dakshina Kannada",
  "Chikkamagaluru",
  "Hassan",
  "Kodagu",
  "Belagavi",
  "Ballari",
  "Bengaluru",
  "Bengaluru Rural",
  "Mysuru",
];

export const KARNATAKA_MARKETS_HINT = [
  "Udupi",
  "Mangaluru",
  "Kundapura",
  "Karkala",
  "Puttur",
  "Belthangady",
  "Sullia",
  "Sulya",
  "Moodabidri",
];

const RESULT_LIMIT = 150;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dates (day arithmetic is done on whole UTC days, so time zones cannot shift
// the 7-day rule)
// ---------------------------------------------------------------------------

function isRealDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// Accepts "YYYY-MM-DD..." or "DD/MM/YYYY"; returns "YYYY-MM-DD" or null.
function toIsoDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return isRealDate(y, m, d) ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (match) {
    const d = Number(match[1]);
    const m = Number(match[2]);
    const y = Number(match[3]);
    if (!isRealDate(y, m, d)) return null;
    return (
      match[3] + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")
    );
  }
  return null;
}

function isoToDayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function todayDayNumber(now) {
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
  );
}

/** Whole days between two "YYYY-MM-DD" dates (b - a), or null if invalid. */
export function mandiDaysBetween(isoA, isoB) {
  if (!isoA || !isoB) return null;
  return isoToDayNumber(isoB) - isoToDayNumber(isoA);
}

/**
 * Freshness of a mandi record from its arrival date.
 * Returns { category: "recent" | "older" | "historical" | "unknown", ageDays }.
 * "unknown" = missing/invalid date, or a date more than a day in the future.
 */
export function getMandiDataFreshness(arrivalDate, { now = new Date() } = {}) {
  const iso = toIsoDate(arrivalDate);
  if (!iso) {
    return { category: "unknown", ageDays: null };
  }
  const ageDays = todayDayNumber(now) - isoToDayNumber(iso);
  if (ageDays < -1) {
    return { category: "unknown", ageDays: null };
  }
  if (ageDays <= MANDI_RECENT_DAYS) {
    return { category: "recent", ageDays: Math.max(ageDays, 0) };
  }
  if (ageDays <= MANDI_OLDER_DAYS) {
    return { category: "older", ageDays };
  }
  return { category: "historical", ageDays };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** "Bengaluru Urban" and "Bangalore" are treated as the API's "Bengaluru". */
export function normalizeDistrictName(name) {
  const key = normalizeReferenceKey(name);
  if (key === "bengaluru urban" || key === "bangalore urban" || key === "bangalore") {
    return "bengaluru";
  }
  return key;
}

/**
 * Farmer-facing crop name -> API commodity name.
 * Returns { apiName, aliasMatched }. A crop that is not in the alias table is
 * returned with the farmer's own spelling and aliasMatched = false; the caller
 * decides what to do if the API has no rows for it.
 */
export function resolveMandiCommodity(input) {
  const typed = normalizeText(input);
  const key = normalizeReferenceKey(typed);
  if (!key) {
    return { apiName: "", aliasMatched: false };
  }
  const names = Object.keys(MANDI_COMMODITY_ALIASES);
  for (let i = 0; i < names.length; i += 1) {
    const apiName = names[i];
    const aliases = MANDI_COMMODITY_ALIASES[apiName] || [];
    if (
      normalizeReferenceKey(apiName) === key ||
      aliases.some((alias) => normalizeReferenceKey(alias) === key)
    ) {
      return { apiName, aliasMatched: true };
    }
  }
  return { apiName: typed.trim().toLowerCase(), aliasMatched: false };
}

// ---------------------------------------------------------------------------
// Live Mandi Price API
// ---------------------------------------------------------------------------

async function requestJson(url, externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onAbort);
    }
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("Mandi Price API returned HTTP " + response.status);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Mandi Price API returned an unreadable response");
    }
    if (payload && payload.success === false) {
      throw new Error(
        payload.error || payload.message || "Mandi Price API reported an error"
      );
    }
    return payload;
  } catch (err) {
    if (err && err.name === "AbortError") {
      if (timedOut) {
        throw new Error("The Mandi Price API took too long to respond.");
      }
      throw err; // aborted by the caller (component unmounted): not an error
    }
    if (err instanceof TypeError) {
      throw new Error("Could not reach the Mandi Price API (network or CORS).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Turns the raw API payload ({ success, data: [...] }) into clean rows.
 * Every row keeps market, district, variety, grade and the arrival date.
 * The API has no unit field, so `unit` is always null here.
 */
export function normalizeLiveMandiRows(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.data)
    ? payload.data
    : [];

  const rows = [];
  list.forEach((raw) => {
    if (!raw || typeof raw !== "object") return;
    const market = normalizeText(raw.market);
    const commodity = normalizeText(raw.commodity);
    if (!market || !commodity) return;

    const variety = normalizeText(raw.variety);
    const grade = normalizeText(raw.grade);
    const date = toIsoDate(raw.arrival_date);

    rows.push({
      id:
        raw.id !== undefined && raw.id !== null
          ? raw.id
          : [market, commodity, variety, grade, date].join("|"),
      state: normalizeText(raw.state),
      district: normalizeText(raw.district),
      market: market,
      commodity: commodity,
      variety: variety,
      grade: grade,
      arrival_date: date,
      date: date,
      min_price: toNumber(raw.min_price),
      max_price: toNumber(raw.max_price),
      modal_price: toNumber(raw.modal_price),
      fetched_at: raw.fetched_at || null,
      unit: null,
      sourceType: "live-api",
      source: MARKET_PRICE_SOURCE_LABEL,
    });
  });
  return rows;
}

/** A row is usable only if its prices are real, positive and consistent. */
export function isValidMandiPriceRow(row) {
  if (!row) return false;
  const modal = row.modal_price;
  if (modal === null || modal === undefined || !Number.isFinite(modal) || modal <= 0) {
    return false;
  }
  const min = row.min_price;
  const max = row.max_price;
  const hasMin = min !== null && min !== undefined && Number.isFinite(min);
  const hasMax = max !== null && max !== undefined && Number.isFinite(max);
  if (hasMin && min < 0) return false;
  if (hasMax && max < 0) return false;
  if (hasMin && hasMax && min > max) return false;
  if (hasMin && modal < min) return false;
  if (hasMax && modal > max) return false;
  return true;
}

function newerRow(a, b) {
  // true when `a` is newer than `b`
  const da = a.arrival_date || "";
  const db = b.arrival_date || "";
  if (da !== db) return da > db;
  return String(a.fetched_at || "") > String(b.fetched_at || "");
}

/**
 * One response can hold many dates and many rows per market. Keeps only the
 * newest row for each market + variety + grade.
 */
export function getLatestRowsByMarket(rows) {
  const latest = new Map();
  (rows || []).forEach((row) => {
    const key = [
      normalizeDistrictName(row.district),
      normalizeReferenceKey(row.market),
      normalizeReferenceKey(row.variety),
      normalizeReferenceKey(row.grade),
    ].join("|");
    const current = latest.get(key);
    if (!current || newerRow(row, current)) {
      latest.set(key, row);
    }
  });
  return Array.from(latest.values());
}

/** Keeps only rows whose arrival date is within the last `maxAgeDays` days. */
export function filterRecentMandiRows(
  rows,
  { now = new Date(), maxAgeDays = MANDI_RECENT_DAYS } = {}
) {
  const today = todayDayNumber(now);
  return (rows || []).filter((row) => {
    if (!row || !row.arrival_date) return false;
    const age = today - isoToDayNumber(row.arrival_date);
    // age -1 tolerates a time-zone difference; anything further in the future
    // or older than maxAgeDays is rejected.
    return age >= -1 && age <= maxAgeDays;
  });
}

const liveCache = new Map();

/**
 * Fetches normalized rows from the live API.
 * Returns { rows, error } and never throws; error is an Error or null.
 * A caller-aborted request returns an error whose name is "AbortError".
 */
export async function fetchLiveMandiPrices(
  { commodity, state = "Karnataka" } = {},
  { signal, timeoutMs = LIVE_TIMEOUT_MS, forceRefresh = false } = {}
) {
  const name = normalizeText(commodity);
  if (!name) {
    return { rows: [], error: null };
  }

  let url = MANDI_API_BASE + "/v1/prices?";
  const stateName = normalizeText(state);
  if (stateName) {
    url += "state=" + encodeURIComponent(stateName) + "&";
  }
  url += "commodity=" + encodeURIComponent(name);

  const cached = liveCache.get(url);
  if (!forceRefresh && cached && Date.now() - cached.time < LIVE_CACHE_MS) {
    return { rows: cached.rows, error: null };
  }

  try {
    const payload = await requestJson(url, signal, timeoutMs);
    const rows = normalizeLiveMandiRows(payload);
    liveCache.set(url, { time: Date.now(), rows: rows });
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err };
  }
}

// Market Prices page, live mode: every valid record the API returned, of ANY
// age, newest first. Each row keeps its real arrival date; the page labels it
// Recent / Older / Historical. Nothing is cut off by age here.
async function searchLiveMarketPrices({ commodity, state, district, market }) {
  const { apiName } = resolveMandiCommodity(commodity);
  const live = await fetchLiveMandiPrices({ commodity: apiName, state });
  if (live.error) {
    return { rows: [], error: live.error };
  }

  const wantedCommodity = apiName;
  const wantedState = String(state || "").trim().toLowerCase();
  const wantedDistrict = normalizeDistrictName(district);
  const wantedMarket = String(market || "").trim().toLowerCase();

  let rows = live.rows.filter(
    (row) => commodityNamesMatch(row.commodity, wantedCommodity)
  );
  if (wantedState) {
    rows = rows.filter((row) => String(row.state || "").trim().toLowerCase() === wantedState);
  }
  if (wantedDistrict) {
    rows = rows.filter(
      (row) => normalizeDistrictName(row.district) === wantedDistrict
    );
  }
  if (wantedMarket) {
    rows = rows.filter((row) =>
      String(row.market || "").trim().toLowerCase().includes(wantedMarket)
    );
  }

  rows = rows.filter(isValidMandiPriceRow);
  rows.sort((a, b) => {
    const da = a.arrival_date || "";
    const db = b.arrival_date || "";
    if (da !== db) return da < db ? 1 : -1;
    return a.market.localeCompare(b.market);
  });
  return { rows: rows.slice(0, RESULT_LIMIT), error: null };
}

// Supabase market_prices table (existing behaviour, unchanged).
async function searchSupabasePrices({
  commodity,
  state = "",
  district = "",
  market = "",
}) {
  const term = normalizeText(commodity);

  let query = supabase
    .from("market_prices")
    .select(
      "id, commodity, variety, state, district, market, min_price, max_price, modal_price, date, unit, source"
    )
    .ilike("commodity", `%${term}%`)
    .order("date", { ascending: false })
    .limit(RESULT_LIMIT);

  const stateFilter = normalizeText(state);
  const districtFilter = normalizeText(district);
  const marketFilter = normalizeText(market);

  if (stateFilter) {
    query = query.ilike("state", stateFilter);
  }
  if (districtFilter) {
    query = query.ilike("district", `%${districtFilter}%`);
  }
  if (marketFilter) {
    query = query.ilike("market", `%${marketFilter}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: [], error };
  }

  return {
    rows: (data || []).map((row) => ({ ...row, sourceType: "supabase" })),
    error: null,
  };
}

// Enabled reference/demo rows live in their own table and are never written to
// market_prices. A missing table or an RLS/query error is returned safely so
// the page can keep rendering its empty state.
async function searchSupabaseFallbackPrices({
  commodity,
  state = "",
  district = "",
  market = "",
}) {
  try {
    const { data, error } = await supabase
      .from("fallback_crop_prices")
      .select("*")
      .eq("enabled", true)
      .limit(1000);

    if (error) return { rows: [], error };
    return {
      rows: mapFallbackCropPriceRows(data, commodity, { state, district, market }),
      error: null,
    };
  } catch (error) {
    return { rows: [], error };
  }
}

/**
 * Search mandi prices for the Market Prices page.
 *
 * source: "auto" (default) -> live Mandi Price API first, then stored
 *                              Supabase records, then enabled fallback_crop_prices.
 *         "live"           -> live API only
 *         "supabase"       -> stored table only (the original behaviour)
 *
 * Return shape stays { rows, error }. Extra keys:
 *   sourceType        "live-api" | "supabase" | "fallback-supabase"
 *   liveFallbackReason set when stored Supabase rows replace unavailable API data
 *
 * @param {{ commodity: string, state?: string, district?: string, market?: string, source?: string }} params
 */
export async function searchMarketPrices({
  commodity,
  state = "",
  district = "",
  market = "",
  source = "auto",
}) {
  const term = normalizeText(commodity);
  if (!term) {
    return { rows: [], error: null, sourceType: null };
  }

  let liveFallbackReason = null;
  let live = null;

  if (source !== "supabase") {
    live = await searchLiveMarketPrices({
      commodity: term,
      state,
      district,
      market,
    });
    if (source === "live") {
      return prioritizeMarketPriceResults({ live, stored: null });
    }
    liveFallbackReason = live.error
      ? live.error.message || "unavailable"
      : "no-rows";
  }

  const stored = await searchSupabasePrices({ commodity: term, state, district, market });
  if (source === "supabase") {
    return prioritizeMarketPriceResults({ live: null, stored });
  }
  if (stored.rows.length > 0) {
    return {
      ...prioritizeMarketPriceResults({ live, stored }),
      liveFallbackReason,
    };
  }
  const fallback = await searchSupabaseFallbackPrices({
    commodity: term,
    state,
    district,
    market,
  });
  return {
    ...prioritizeMarketPriceResults({ live, stored, fallback }),
    liveFallbackReason,
  };
}

export function formatPriceInr(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return "—";
  }
  return `₹${num.toLocaleString("en-IN")}`;
}

export function formatMarketPriceDate(isoDate) {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}
