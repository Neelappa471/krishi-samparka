// ---------------------------------------------------------------------------
// Shared helpers for the farmer + buyer marketplace screens.
// Pure functions and constants only (no React, no Supabase calls).
// ---------------------------------------------------------------------------
import { REGIONS } from "../data/regions";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from "../i18n/translations";

// Database columns used
//   public.listings:           id, farmer_id, product_name, photo_url, quantity,
//                              unit, expected_price, available_date, location,
//                              latitude, longitude, status, created_at
//   public.buyer_requirements: id, buyer_id, product_name, quantity, unit,
//                              max_price, required_date, location, latitude,
//                              longitude, status, created_at
export const LISTING_COLUMNS =
  "id, farmer_id, product_name, photo_url, quantity, unit, expected_price, available_date, location, latitude, longitude, status, created_at";
export const REQ_COLUMNS =
  "id, buyer_id, product_name, quantity, unit, max_price, required_date, location, latitude, longitude, status, created_at";
// Requirements of OTHER buyers: no buyer_id
export const REQ_PUBLIC_COLUMNS =
  "id, product_name, quantity, unit, max_price, required_date, location, latitude, longitude, status, created_at";

export const LANG_STORAGE_KEY = "krishisetu-language";

// Display-only fallback. When a saved row has no latitude/longitude, the map
// uses the coordinates of the named location from regions.js. Nothing is
// written to the database and nothing is guessed: an unknown location still
// gets NO marker. Set to false to use ONLY coordinates stored in Supabase.
export const USE_REGION_FALLBACK = true;

export const UNIT_VALUES = ["kg", "quintal", "ton", "pieces", "dozen", "bags", "litres"];

// Same supported locations as translations.js ("loc.<name>")
export const LOCATION_VALUES = [
  "Udupi",
  "Mangaluru",
  "Kundapura",
  "Karkala",
  "Puttur",
  "Belthangady",
  "Sullia",
  "Moodabidri",
  "Bengaluru",
  "Mysuru",
  "Kasaragod",
  "Mumbai",
];

// --- Language shared by both dashboards -------------------------------------
export function readSavedLanguage() {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && LANGUAGE_OPTIONS.some((option) => option.code === saved)) {
      return saved;
    }
  } catch (error) {
    // localStorage can be unavailable; fall back to the default
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(code) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, code);
  } catch (error) {
    // ignore: language still changes for this visit
  }
}

// --- Values -------------------------------------------------------------------
export function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function isCoord(value) {
  return hasValue(value) && Number.isFinite(Number(value));
}

// True only when the row itself has stored latitude AND longitude
export function hasCoords(row) {
  return Boolean(row) && isCoord(row.latitude) && isCoord(row.longitude);
}

// Coordinates come from regions.js (matched by name or id). Nothing is
// invented: an unknown location returns null.
export function findCoordinates(location) {
  const wanted = String(location || "").trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const region = (REGIONS || []).find(
    (item) =>
      String(item.name || "").trim().toLowerCase() === wanted ||
      String(item.id || "").trim().toLowerCase() === wanted
  );
  if (region && isCoord(region.latitude) && isCoord(region.longitude)) {
    return { latitude: Number(region.latitude), longitude: Number(region.longitude) };
  }
  return null;
}

// Where a row should be drawn on the map:
//   1. its own stored latitude / longitude (always preferred), else
//   2. (display only) the coordinates of its named location from regions.js
//   3. otherwise null -> no marker
export function resolveCoords(row) {
  if (!row) {
    return null;
  }
  if (hasCoords(row)) {
    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      fromRegion: false,
    };
  }
  if (USE_REGION_FALLBACK) {
    const found = findCoordinates(row.location);
    if (found) {
      return { latitude: found.latitude, longitude: found.longitude, fromRegion: true };
    }
  }
  return null;
}

export function errorText(error) {
  return error && error.message ? error.message : "unknown error";
}

// Insert a row at the top of a list, or replace the row with the same id.
export function upsertRow(list, row) {
  if (!row || !row.id) {
    return list;
  }
  const exists = list.some((item) => item.id === row.id);
  if (exists) {
    return list.map((item) => (item.id === row.id ? { ...item, ...row } : item));
  }
  return [row, ...list];
}

// "2026-10-10" -> "10 Oct 2026" (parsed manually to avoid timezone shifts).
// Returns `fallback` for an empty value.
export function formatDate(value, locale, fallback) {
  if (!value) {
    return fallback === undefined ? "" : fallback;
  }
  const parts = String(value).slice(0, 10).split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) {
    return String(value);
  }
  return new Date(year, month - 1, day).toLocaleDateString(locale || "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}