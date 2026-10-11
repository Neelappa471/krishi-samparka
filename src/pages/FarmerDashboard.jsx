import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
} from "react";
import MessagesCenter from "../components/Messaging/MessagesCenter";
import FarmerMarketplace from "../components/Marketplace/FarmerMarketplace";
// NOTE: if your config/supabase.js uses a default export, change this to:
//   import supabase from "../config/supabase";
import { supabase } from "../config/supabase";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  translate,
} from "../i18n/translations";
import {
  readSavedLanguage,
  saveLanguage,
  REQ_COLUMNS,
  resolveCoords,
} from "../utils/marketplaceData";
import {
  findDemandMatches,
  normalizeListing,
  normalizeRequirement,
} from "../utils/matchEngine";
import { explainMatch } from "../utils/matchExplain";
import {
  startConversation,
  isMessagingNotSetUp,
} from "../components/Messaging/messagingApi";
import {
  searchMarketPrices,
  formatPriceInr,
  KARNATAKA_DISTRICTS,
} from "../utils/marketPriceApi";

// ---------------------------------------------------------------------------
// Styles (scoped with the "ks-fd" prefix so nothing else is affected)
// ---------------------------------------------------------------------------
const DASHBOARD_CSS = `
.ks-fd {
  min-height: 100vh;
  display: flex;
  background: #f4f9f4;
  color: #1f2937;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Kannada", sans-serif;
  text-align: left;
}
.ks-fd *, .ks-fd *::before, .ks-fd *::after { box-sizing: border-box; }
.ks-fd button { font-family: inherit; }

/* Sidebar */
.ks-fd-side {
  width: 230px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e3ece3;
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ks-fd-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.ks-fd-brand-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: #e8f5e9; color: #166534;
  display: flex; align-items: center; justify-content: center;
}
.ks-fd-brand-name { font-size: 18px; font-weight: 700; color: #14532d; }
.ks-fd-nav { display: flex; flex-direction: column; gap: 4px; }
.ks-fd-nav-item {
  display: flex; align-items: center; gap: 10px;
  min-height: 42px; padding: 0 12px;
  border: none; border-radius: 10px;
  background: transparent; color: #374151;
  font-size: 14px; cursor: pointer; text-align: left;
}
.ks-fd-nav-item:hover { background: #f0f7f0; }
.ks-fd-nav-item[aria-current="page"] {
  background: #14532d; color: #ffffff; font-weight: 600;
}

/* Main area */
.ks-fd-main { flex: 1; min-width: 0; padding: 20px 28px 40px; }
.ks-fd-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 24px;
}
.ks-fd-header-title { font-size: 14px; color: #6b7280; margin: 0; }
.ks-fd-header-right { display: flex; align-items: center; gap: 10px; }
.ks-fd-profile {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 12px 4px 4px;
  background: #ffffff; border: 1px solid #e3ece3; border-radius: 999px;
}
.ks-fd-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #dcfce7; color: #166534;
  display: flex; align-items: center; justify-content: center;
}
.ks-fd-profile-text { line-height: 1.2; }
.ks-fd-profile-name { font-size: 13px; font-weight: 600; }
.ks-fd-profile-role { font-size: 11px; color: #6b7280; }
.ks-fd-logout {
  display: flex; align-items: center; gap: 6px;
  min-height: 40px; padding: 0 14px;
  border: 1px solid #cfdccf; border-radius: 10px;
  background: #ffffff; color: #374151;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.ks-fd-logout:hover { background: #f0f7f0; }
.ks-fd-logout:disabled { opacity: 0.6; cursor: not-allowed; }
.ks-fd-lang {
  min-height: 40px; padding: 0 10px;
  border: 1px solid #cfdccf; border-radius: 10px;
  background: #ffffff; color: #374151;
  font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
}
.ks-fd-lang:focus-visible { outline: 3px solid #86efac; outline-offset: 2px; }

/* Welcome */
.ks-fd-welcome { margin-bottom: 20px; }
.ks-fd-welcome h1 { margin: 0; font-size: 28px; line-height: 1.2; color: #111827; }
.ks-fd-welcome p { margin: 6px 0 0; font-size: 15px; color: #4b5563; max-width: 620px; }

/* Hero banner */
.ks-fd-hero {
  background: linear-gradient(135deg, #14532d, #1f2937);
  color: #ffffff;
  border-radius: 20px;
  padding: 22px 24px;
  margin-bottom: 20px;
}
.ks-fd-hero-label {
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7;
}
.ks-fd-hero-stats { display: flex; flex-wrap: wrap; gap: 28px; margin: 10px 0 8px; }
.ks-fd-hero-value { font-size: 28px; font-weight: 700; color: #bbf7d0; }
.ks-fd-hero-caption { font-size: 12px; opacity: 0.75; }
.ks-fd-hero-note { margin: 0; font-size: 12px; opacity: 0.7; }

/* Cards */
.ks-fd-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.ks-fd-card {
  display: flex; align-items: center; gap: 14px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #e3ece3;
  border-radius: 16px;
  text-align: left; color: inherit;
  cursor: pointer;
}
.ks-fd-card:hover { border-color: #86efac; background: #fbfefb; }
.ks-fd-card-icon {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: 12px;
  background: #e8f5e9; color: #166534;
  display: flex; align-items: center; justify-content: center;
}
.ks-fd-card-body { flex: 1; min-width: 0; }
.ks-fd-card-title { font-size: 15px; font-weight: 700; color: #111827; }
.ks-fd-card-desc { font-size: 13px; color: #6b7280; margin-top: 2px; display: block; }
.ks-fd-card-arrow { color: #9ca3af; flex-shrink: 0; }

/* Section pages (listings, prices, requests, map) */
.ks-fd-section-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px; margin-bottom: 6px;
}
.ks-fd-section-head h1 { margin: 0; font-size: 24px; color: #111827; }
.ks-fd-demo-badge {
  padding: 3px 10px; border-radius: 999px;
  background: #fef3c7; color: #92400e;
  font-size: 12px; font-weight: 600;
}
.ks-fd-section-sub { margin: 0 0 16px; font-size: 14px; color: #4b5563; max-width: 640px; }
.ks-fd-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.ks-fd-price-search {
  background: #ffffff; border: 1px solid #e3ece3; border-radius: 16px;
  padding: 18px; margin-bottom: 16px;
}
.ks-fd-price-filters {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px;
}
.ks-fd-price-table-wrap {
  overflow-x: auto; background: #ffffff; border: 1px solid #e3ece3;
  border-radius: 16px; padding: 12px 8px;
}
.ks-fd-price-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
}
.ks-fd-price-table th, .ks-fd-price-table td {
  padding: 10px 8px; text-align: left; border-bottom: 1px solid #eef2ee;
}
.ks-fd-price-table th { color: #374151; font-weight: 600; white-space: nowrap; }
.ks-fd-price-meta {
  margin-top: 12px; font-size: 13px; color: #4b5563; line-height: 1.5;
}
.ks-fd-price-status { margin-top: 12px; font-size: 14px; }
.ks-fd-price-status--error { color: #b91c1c; }
.ks-fd-price-status--muted { color: #6b7280; }
.ks-fd-item {
  background: #ffffff; border: 1px solid #e3ece3; border-radius: 16px; padding: 16px;
}
.ks-fd-item-top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 10px;
}
.ks-fd-item-title { font-size: 16px; font-weight: 700; color: #111827; }
.ks-fd-status {
  padding: 2px 10px; border-radius: 999px;
  background: #dcfce7; color: #166534;
  font-size: 12px; font-weight: 600; white-space: nowrap;
}
.ks-fd-status-pending { background: #fef3c7; color: #92400e; }
.ks-fd-rows { display: grid; gap: 4px; }
.ks-fd-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.ks-fd-row-label { color: #6b7280; }
.ks-fd-row-value { font-weight: 600; text-align: right; }
.ks-fd-footnote { margin: 14px 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }

/* Listing photo */
.ks-fd-photo {
  width: 100%; height: 170px; object-fit: cover;
  border-radius: 12px; margin-bottom: 12px;
  background: #e8f5e9; display: block;
}
.ks-fd-photo-empty {
  display: flex; align-items: center; justify-content: center;
  color: #166534; font-size: 13px;
}

/* Add Produce form */
.ks-fd-form {
  background: #ffffff; border: 1px solid #e3ece3; border-radius: 16px;
  padding: 20px; max-width: 760px;
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
}
.ks-fd-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ks-fd-field-wide { grid-column: 1 / -1; }
.ks-fd-label { font-size: 13px; font-weight: 600; color: #374151; }
.ks-fd-input {
  min-height: 42px; padding: 0 12px;
  border: 1px solid #cfdccf; border-radius: 10px;
  background: #ffffff; color: #111827;
  font-size: 14px; font-family: inherit; width: 100%;
}
.ks-fd-input:focus-visible { outline: 3px solid #86efac; outline-offset: 1px; }
.ks-fd-input:disabled { background: #f3f4f6; cursor: not-allowed; }
.ks-fd-file { padding: 8px 12px; height: auto; }
.ks-fd-hint { font-size: 12px; color: #6b7280; }
.ks-fd-preview {
  width: 160px; height: 120px; object-fit: cover;
  border-radius: 12px; border: 1px solid #e3ece3; margin-top: 4px;
}
.ks-fd-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; }
.ks-fd-submit {
  min-height: 44px; padding: 0 22px;
  border: none; border-radius: 10px;
  background: #14532d; color: #ffffff;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.ks-fd-submit:hover { background: #166534; }
.ks-fd-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* Listing actions */
.ks-fd-item-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
.ks-fd-delete {
  min-height: 38px; padding: 0 16px;
  border: 1px solid #fecaca; border-radius: 10px;
  background: #ffffff; color: #b91c1c;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.ks-fd-delete:hover { background: #fee2e2; }
.ks-fd-delete:disabled { opacity: 0.6; cursor: not-allowed; }

/* Messages */
.ks-fd-alert {
  max-width: 760px; margin: 0 0 14px; padding: 10px 14px;
  border-radius: 10px; font-size: 14px; line-height: 1.4;
}
.ks-fd-alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.ks-fd-alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.ks-fd-alert-info { background: #ffffff; color: #4b5563; border: 1px solid #e3ece3; }
.ks-fd-empty {
  padding: 28px 16px; text-align: center; color: #4b5563; font-size: 14px;
  background: #ffffff; border: 1px dashed #cfdccf; border-radius: 16px;
}
.ks-fd-empty button {
  margin-top: 12px; min-height: 40px; padding: 0 16px;
  border: none; border-radius: 10px; cursor: pointer;
  background: #14532d; color: #ffffff; font-size: 14px; font-weight: 600;
}
.ks-fd-loading {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: #f4f9f4; color: #4b5563; font-size: 15px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

/* Home: search buyer requirements */
.ks-fd-searchbar {
  display: grid; grid-template-columns: 1.4fr 1fr auto; gap: 10px; align-items: end;
  background: #ffffff; border: 1px solid #e3ece3; border-radius: 16px;
  padding: 16px; margin-bottom: 20px;
}
.ks-fd-searchbar-title {
  grid-column: 1 / -1; margin: 0; font-size: 15px; font-weight: 700; color: #111827;
}
.ks-fd-search-btn {
  min-height: 42px; padding: 0 20px; border: none; border-radius: 10px;
  background: #14532d; color: #ffffff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.ks-fd-search-btn:hover { background: #166534; }

/* Map */
.ks-fd-map-box {
  width: 100%; height: 600px;
  border: 1px solid #e3ece3; border-radius: 16px; overflow: hidden;
  background: #ffffff;
}

.ks-fd button:focus-visible {
  outline: 3px solid #86efac;
  outline-offset: 2px;
}

@media (max-width: 960px) {
  .ks-fd-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .ks-fd-searchbar { grid-template-columns: 1fr; }
  .ks-fd { flex-direction: column; }
  .ks-fd-side {
    width: 100%; border-right: none; border-bottom: 1px solid #e3ece3;
    padding: 12px;
  }
  .ks-fd-nav { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .ks-fd-nav-item { white-space: nowrap; }
  .ks-fd-main { padding: 16px 14px 32px; }
  .ks-fd-profile-text { display: none; }
  .ks-fd-profile { padding: 4px; }
  .ks-fd-list { grid-template-columns: 1fr; }
  .ks-fd-price-filters { grid-template-columns: 1fr; }
  .ks-fd-form { grid-template-columns: 1fr; }
  .ks-fd-map-box { height: 480px; }
}
@media (max-width: 520px) {
  .ks-fd-grid { grid-template-columns: 1fr; }
  .ks-fd-welcome h1 { font-size: 24px; }
}
.ks-fd-badge-complete { background: #dcfce7; color: #166534; font-weight: 700; }
.ks-fd-badge-partial { background: #fef3c7; color: #92400e; font-weight: 700; }
.ks-fd-badge-none { background: #f3f4f6; color: #6b7280; font-weight: 600; }
.ks-fd-match-box {
  margin-top: 14px;
  padding: 12px 14px;
  background: #fbfdfb;
  border: 1px solid #d4e7d4;
  border-radius: 12px;
}
.ks-fd-match-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ks-fd-match-heading {
  font-size: 13px;
  font-weight: 700;
  color: #14532d;
}
.ks-fd-match-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 6px 0;
  font-size: 13px;
}
.ks-fd-match-stat { display: flex; gap: 4px; }
.ks-fd-match-stat-label { color: #6b7280; }
.ks-fd-match-stat-val { font-weight: 600; color: #111827; }
.ks-fd-match-lines {
  margin: 6px 0 10px;
  padding-left: 18px;
  font-size: 12px;
  color: #374151;
  line-height: 1.4;
}
.ks-fd-match-buyers {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.ks-fd-match-buyer-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #e3ece3;
  border-radius: 8px;
  flex-wrap: wrap;
}
.ks-fd-match-buyer-name {
  font-weight: 600;
  font-size: 13px;
  color: #111827;
}
.ks-fd-match-buyer-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
.ks-fd-match-buyer-btn {
  min-height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: #14532d;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ks-fd-match-buyer-btn:hover { background: #166534; }
.ks-fd-match-buyer-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ks-fd-match-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.ks-fd-match-tab { padding: 4px 10px; border-radius: 8px; border: 1px solid #cfdccf; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; color: #374151; }
.ks-fd-match-tab:hover { background: #f0f7f0; }
.ks-fd-match-tab.active { background: #14532d; color: #fff; border-color: #14532d; }
.ks-fd-badge-recommended { background: #dcfce7; color: #14532d; border: 1px solid #86efac; font-weight: 700; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.ks-fd-badge-option { background: #f3f4f6; color: #374151; font-weight: 600; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.ks-fd-price-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRODUCE_BUCKET = "produce-images";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const UNIT_OPTIONS = ["kg", "quintal", "ton", "pieces", "dozen", "bags", "litres"];

// Fixed coordinates for the supported locations (MVP). No geocoding API, no
// browser geolocation. Only these places can be used for a listing.
const SUPPORTED_LOCATIONS = [
  { name: "Udupi", latitude: 13.3409, longitude: 74.7421 },
  { name: "Mangaluru", latitude: 12.9141, longitude: 74.856 },
  { name: "Kundapura", latitude: 13.6333, longitude: 74.69 },
  { name: "Karkala", latitude: 13.2143, longitude: 74.9951 },
  { name: "Puttur", latitude: 12.759, longitude: 75.197 },
  { name: "Belthangady", latitude: 12.984, longitude: 75.296 },
  { name: "Sullia", latitude: 12.561, longitude: 75.387 },
  { name: "Moodabidri", latitude: 13.0667, longitude: 74.995 },
  { name: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
  { name: "Mysuru", latitude: 12.2958, longitude: 76.6394 },
  { name: "Kasaragod", latitude: 12.4996, longitude: 74.9869 },
  { name: "Mumbai", latitude: 19.076, longitude: 72.8777 },
];

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { id: "home", labelKey: "nav.home", icon: "home" },
  { id: "add", labelKey: "nav.add", icon: "plus" },
  { id: "listings", labelKey: "nav.listings", icon: "list" },
  { id: "prices", labelKey: "nav.prices", icon: "chart" },
  { id: "opportunities", labelKey: "nav.opportunities", icon: "spark" },
  { id: "requests", labelKey: "nav.requests", icon: "inbox" },
  { id: "messages", labelKey: "nav.messages", icon: "chat" },
];

// Cards on the Home page (no Home card)
const DASHBOARD_CARDS = [
  {
    id: "add",
    titleKey: "nav.add",
    descKey: "card.add.desc",
    icon: "plus",
  },
  {
    id: "listings",
    titleKey: "nav.listings",
    descKey: "card.listings.desc",
    icon: "list",
  },
  {
    id: "prices",
    titleKey: "nav.prices",
    descKey: "card.prices.desc",
    icon: "chart",
  },
  {
    id: "opportunities",
    titleKey: "nav.opportunities",
    descKey: "card.opportunities.desc",
    icon: "spark",
  },
  {
    id: "requests",
    titleKey: "nav.requests",
    descKey: "card.requests.desc",
    icon: "inbox",
  },
  {
    id: "messages",
    titleKey: "nav.messages",
    descKey: "card.messages.desc",
    icon: "chat",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// "2026-10-10" -> "10 Oct 2026" (parsed manually to avoid timezone shifts)
function formatDate(value, locale, notSetText) {
  if (!value) return notSetText;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Language (simple React context; the selected language lives in React state
// inside FarmerDashboard)
// ---------------------------------------------------------------------------
const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
});

function useI18n() {
  return useContext(I18nContext);
}

// Translates a stored value (unit, location, crop...). Stored values stay in
// English in the database; only the displayed text changes. Unknown values are
// shown as they are (e.g. an older listing with a different unit).
function labelFor(t, prefix, value) {
  const key = prefix + value;
  const text = t(key);
  return text === key ? value : text;
}

// A message is { type, key, detail } or { type, raw } so it can be re-translated
// when the language changes.
function renderMessage(t, message) {
  if (message.raw !== undefined) return message.raw;
  return t(message.key, { detail: message.detail || t("common.unknownError") });
}

function getDemandMatchExplanation(result, lang, t) {
  if (!result) return [];
  const explanation = explainMatch(result, lang);
  const isRawKey = (text) =>
    typeof text === "string" && (text.startsWith("explain.") || text.startsWith("match."));

  const lines = explanation && Array.isArray(explanation.lines) ? explanation.lines : [];
  const hasRawKeys =
    (explanation && isRawKey(explanation.headline)) || lines.some(isRawKey);

  if (!hasRawKeys && lines.length > 0) {
    return lines;
  }

  // Safe fallback if translation keys are not in translations.js
  const fallbackLines = [];
  const unit = labelFor(t, "unit.", result.displayUnit);
  const prod = labelFor(t, "crop.", result.anchor.productName);
  const best = result.best;

  if (!best || !best.matchedQuantity) {
    fallbackLines.push(
      result.availableQuantity > 0
        ? `Found ${result.availableQuantity} ${unit} of buyer demand for ${prod}, but not enough to meet criteria.`
        : `No matching buyer requirements currently found for ${prod}.`
    );
    return fallbackLines;
  }

  const count = best.participantCount;
  if (result.status === "complete" || (best.coverage >= 1 - 1e-6)) {
    if (count === 1) {
      const buyerName = best.participants[0].name || "Buyer";
      fallbackLines.push(
        `Complete match: 100% demanded by ${buyerName} (${best.matchedQuantity} ${unit} ${prod}).`
      );
    } else {
      fallbackLines.push(
        `Complete match: 100% demanded across ${count} buyers (${best.matchedQuantity} ${unit} ${prod}).`
      );
    }
  } else {
    fallbackLines.push(
      `Partial match: ${best.matchedQuantity} of ${result.required} ${unit} ${prod} demanded across ${count} buyer${count > 1 ? "s" : ""}.`
    );
  }

  if (best.avgDistanceKm !== null) {
    fallbackLines.push(`Average distance: ~${best.avgDistanceKm} km.`);
  }
  if (best.totalPrice !== null) {
    fallbackLines.push(`Total potential value: ₹${best.totalPrice}.`);
  }

  return fallbackLines;
}

// Error carrying a translation key (shown translated in the UI)
function i18nError(key, detail) {
  const error = new Error(detail || key);
  error.i18nKey = key;
  error.detail = detail;
  return error;
}

function fileExtension(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg"; // image/jpeg covers .jpg and .jpeg
}

// Case-insensitive, whitespace-trimmed lookup. Returns
// { name, latitude, longitude } for a supported location, otherwise null.
function resolveLocation(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return null;
  const match = SUPPORTED_LOCATIONS.find(
    (place) => place.name.toLowerCase() === key
  );
  return match || null;
}

function uniqueId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Small inline icons (no icon library needed)
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  leaf: [
    "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z",
    "M2 21c0-3 1.9-5.4 5-6",
  ],
  home: ["M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
  plus: ["M12 5v14", "M5 12h14"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  chart: ["M3 3v18h18", "M7 15l4-4 3 3 5-6"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z",
  ],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  chevron: ["M9 6l6 6-6 6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
};

function Icon({ name, size = 20 }) {
  const paths = ICON_PATHS[name] || [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------
function DashboardCard({ title, description, icon, onClick }) {
  return (
    <button type="button" className="ks-fd-card" onClick={onClick}>
      <span className="ks-fd-card-icon">
        <Icon name={icon} size={22} />
      </span>
      <span className="ks-fd-card-body">
        <span className="ks-fd-card-title">{title}</span>
        <span className="ks-fd-card-desc">{description}</span>
      </span>
      <span className="ks-fd-card-arrow">
        <Icon name="chevron" size={18} />
      </span>
    </button>
  );
}

// Heading block used by every section page
function SectionHeader({ title, subtitle, demo = true }) {
  const { t } = useI18n();
  return (
    <>
      <div className="ks-fd-section-head">
        <h1>{title}</h1>
        {demo && <span className="ks-fd-demo-badge">{t("common.demoBadge")}</span>}
      </div>
      <p className="ks-fd-section-sub">{subtitle}</p>
    </>
  );
}

// One white card with a title, an optional status and label/value rows
function InfoCard({ title, status, rows, photoUrl, actions, children }) {
  const { t } = useI18n();
  const pending = status === "Pending" || status === "Possible match";
  return (
    <div className="ks-fd-item">
      {photoUrl !== undefined &&
        (photoUrl ? (
          <img className="ks-fd-photo" src={photoUrl} alt={title} loading="lazy" />
        ) : (
          <div className="ks-fd-photo ks-fd-photo-empty">{t("common.noPhoto")}</div>
        ))}
      <div className="ks-fd-item-top">
        <span className="ks-fd-item-title">{title}</span>
        {status && (
          <span
            className={"ks-fd-status" + (pending ? " ks-fd-status-pending" : "")}
          >
            {status}
          </span>
        )}
      </div>
      <div className="ks-fd-rows">
        {rows.map((row) => (
          <div className="ks-fd-row" key={row.label}>
            <span className="ks-fd-row-label">{row.label}</span>
            <span className="ks-fd-row-value">{row.value}</span>
          </div>
        ))}
      </div>
      {children}
      {actions && <div className="ks-fd-item-actions">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section pages
// ---------------------------------------------------------------------------
function HomeSection({
  onNavigate,
  farmerName,
  activeListingCount,
  listingsLoading,
  buyerRequestCount,
  onSearchBuyers,
}) {
  const { t } = useI18n();
  const [searchProduct, setSearchProduct] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  const handleSearch = (event) => {
    event.preventDefault();
    onSearchBuyers(searchProduct, searchLocation);
  };

  return (
    <>
      <section className="ks-fd-welcome">
        <h1>{t("home.welcome", { name: farmerName })}</h1>
        <p>{t("home.intro")}</p>
      </section>

      <form className="ks-fd-searchbar" onSubmit={handleSearch}>
        <h2 className="ks-fd-searchbar-title">{t("fm.home.searchTitle")}</h2>
        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-home-product">
            {t("fm.search.product")}
          </label>
          <input
            id="ks-fd-home-product"
            className="ks-fd-input"
            type="text"
            value={searchProduct}
            placeholder={t("fm.search.productPlaceholder")}
            onChange={(event) => setSearchProduct(event.target.value)}
          />
        </div>
        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-home-location">
            {t("list.location")}
          </label>
          <select
            id="ks-fd-home-location"
            className="ks-fd-input"
            value={searchLocation}
            onChange={(event) => setSearchLocation(event.target.value)}
          >
            <option value="">{t("fm.search.allLocations")}</option>
            {SUPPORTED_LOCATIONS.map((place) => (
              <option key={place.name} value={place.name}>
                {labelFor(t, "loc.", place.name)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="ks-fd-search-btn">
          {t("fm.search.button")}
        </button>
      </form>
          

      <section className="ks-fd-hero" aria-label={t("home.activityAria")}>
        <div className="ks-fd-hero-label">{t("home.activity")}</div>
        <div className="ks-fd-hero-stats">
          <div>
            <div className="ks-fd-hero-value">
              {listingsLoading ? "…" : activeListingCount}
            </div>
            <div className="ks-fd-hero-caption">{t("home.activeListings")}</div>
          </div>
          <div>
            <div className="ks-fd-hero-value">
              {buyerRequestCount === null ? "…" : buyerRequestCount}
            </div>
            <div className="ks-fd-hero-caption">{t("home.buyerRequests")}</div>
          </div>
        </div>
      </section>

      <section className="ks-fd-grid" aria-label={t("home.sectionsAria")}>
        {DASHBOARD_CARDS.map((card) => (
          <DashboardCard
            key={card.id}
            title={t(card.titleKey)}
            description={t(card.descKey)}
            icon={card.icon}
            onClick={() => onNavigate(card.id)}
          />
        ))}
      </section>

    </>
  );
}

// ---- Add Produce ----------------------------------------------------------
const EMPTY_FORM = {
  productName: "",
  quantity: "",
  unit: "",
  expectedPrice: "",
  availableDate: "",
  location: "",
};

function AddProduceSection({ user, onCreated }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | uploading | saving
  const [message, setMessage] = useState(null); // { type, text }

  const submitting = phase !== "idle";

  // Create / clean up the local preview URL for the chosen photo
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const setField = (name) => (event) =>
    setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const handlePhotoChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      setPhoto(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setMessage({ type: "error", key: "msg.photoType" });
      setPhoto(null);
      setFileInputKey((k) => k + 1);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({ type: "error", key: "msg.photoSize" });
      setPhoto(null);
      setFileInputKey((k) => k + 1);
      return;
    }
    setMessage(null);
    setPhoto(file);
  };

  const validate = () => {
    if (!form.productName.trim()) return "msg.enterProduct";
    if (!photo) return "msg.selectPhoto";
    const qty = Number(form.quantity);
    if (!form.quantity || !Number.isFinite(qty) || qty <= 0) {
      return "msg.enterQuantity";
    }
    if (!form.unit) return "msg.selectUnit";
    const price = Number(form.expectedPrice);
    if (!form.expectedPrice || !Number.isFinite(price) || price <= 0) {
      return "msg.enterPrice";
    }
    if (!form.availableDate) return "msg.selectDate";
    if (!resolveLocation(form.location)) return "msg.unsupportedLocation";
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setMessage(null);

    const problem = validate();
    if (problem) {
      setMessage({ type: "error", key: problem });
      return;
    }
    if (!user) {
      setMessage({ type: "error", key: "msg.notLoggedIn" });
      return;
    }

    // Resolve the location first so an unsupported place never uploads a photo
    // or saves null coordinates.
    const place = resolveLocation(form.location);
    if (!place) {
      setMessage({ type: "error", key: "msg.unsupportedLocation" });
      return;
    }

    let uploadedPath = null;

    try {
      // 1. Upload the photo with a unique filename inside the farmer's folder
      setPhase("uploading");
      uploadedPath = `${user.id}/${uniqueId()}.${fileExtension(photo)}`;

      const { error: uploadError } = await supabase.storage
        .from(PRODUCE_BUCKET)
        .upload(uploadedPath, photo, {
          contentType: photo.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        uploadedPath = null;
        throw i18nError("msg.uploadFailed", uploadError.message);
      }

      // 2. Public URL of the uploaded photo
      const { data: urlData } = supabase.storage
        .from(PRODUCE_BUCKET)
        .getPublicUrl(uploadedPath);
      const photoUrl = urlData && urlData.publicUrl;
      if (!photoUrl) {
        throw i18nError("msg.photoUrlFailed");
      }

      // 3. Save the listing
      setPhase("saving");
      const { error: insertError } = await supabase.from("listings").insert({
        farmer_id: user.id,
        product_name: form.productName.trim(),
        photo_url: photoUrl,
        quantity: Number(form.quantity),
        unit: form.unit,
        expected_price: Number(form.expectedPrice),
        available_date: form.availableDate,
        location: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        status: "active",
      });

      if (insertError) {
        throw i18nError("msg.createFailed", insertError.message);
      }

      // 4. Success: reset the form and refresh the dashboard data
      setForm(EMPTY_FORM);
      setPhoto(null);
      setFileInputKey((k) => k + 1);
      setMessage({ type: "success", key: "msg.listed" });
      await onCreated();
    } catch (err) {
      // Best effort: don't leave an orphaned photo if the listing failed
      if (uploadedPath) {
        try {
          await supabase.storage.from(PRODUCE_BUCKET).remove([uploadedPath]);
        } catch (cleanupError) {
          // ignore cleanup failure
        }
      }
      if (err && err.i18nKey) {
        setMessage({ type: "error", key: err.i18nKey, detail: err.detail });
      } else if (err && err.message) {
        setMessage({ type: "error", raw: err.message });
      } else {
        setMessage({ type: "error", key: "msg.genericError" });
      }
    } finally {
      setPhase("idle");
    }
  };

  let buttonLabel = t("form.submit");
  if (phase === "uploading") buttonLabel = t("form.uploading");
  if (phase === "saving") buttonLabel = t("form.saving");

  return (
    <>
      <SectionHeader
        title={t("add.title")}
        subtitle={t("add.subtitle")}
        demo={false}
      />

      {message && (
        <div
          className={"ks-fd-alert ks-fd-alert-" + message.type}
          role={message.type === "error" ? "alert" : "status"}
        >
          {renderMessage(t, message)}
        </div>
      )}

      <form className="ks-fd-form" onSubmit={handleSubmit} noValidate>
        <div className="ks-fd-field ks-fd-field-wide">
          <label className="ks-fd-label" htmlFor="ks-fd-product">
            {t("form.product")}
          </label>
          <input
            id="ks-fd-product"
            className="ks-fd-input"
            type="text"
            value={form.productName}
            onChange={setField("productName")}
            placeholder={t("form.productPlaceholder")}
            disabled={submitting}
          />
        </div>

        <div className="ks-fd-field ks-fd-field-wide">
          <label className="ks-fd-label" htmlFor="ks-fd-photo">
            {t("form.photo")}
          </label>
          <input
            key={fileInputKey}
            id="ks-fd-photo"
            className="ks-fd-input ks-fd-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            disabled={submitting}
          />
          <span className="ks-fd-hint">{t("form.photoHint")}</span>
          {previewUrl && (
            <img className="ks-fd-preview" src={previewUrl} alt={t("form.photoAlt")} />
          )}
        </div>

        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-quantity">
            {t("form.quantity")}
          </label>
          <input
            id="ks-fd-quantity"
            className="ks-fd-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.quantity}
            onChange={setField("quantity")}
            placeholder={t("form.quantityPlaceholder")}
            disabled={submitting}
          />
        </div>

        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-unit">
            {t("form.unit")}
          </label>
          <select
            id="ks-fd-unit"
            className="ks-fd-input"
            value={form.unit}
            onChange={setField("unit")}
            disabled={submitting}
          >
            <option value="">{t("form.selectUnit")}</option>
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {labelFor(t, "unit.", unit)}
              </option>
            ))}
          </select>
        </div>

        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-price">
            {t("form.price")}
          </label>
          <input
            id="ks-fd-price"
            className="ks-fd-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.expectedPrice}
            onChange={setField("expectedPrice")}
            placeholder={t("form.pricePlaceholder")}
            disabled={submitting}
          />
        </div>

        <div className="ks-fd-field">
          <label className="ks-fd-label" htmlFor="ks-fd-date">
            {t("form.date")}
          </label>
          <input
            id="ks-fd-date"
            className="ks-fd-input"
            type="date"
            value={form.availableDate}
            onChange={setField("availableDate")}
            disabled={submitting}
          />
        </div>

        <div className="ks-fd-field ks-fd-field-wide">
          <label className="ks-fd-label" htmlFor="ks-fd-location">
            {t("form.location")}
          </label>
          <select
            id="ks-fd-location"
            className="ks-fd-input"
            value={form.location}
            onChange={setField("location")}
            disabled={submitting}
          >
            <option value="">{t("form.selectLocation")}</option>
            {SUPPORTED_LOCATIONS.map((place) => (
              <option key={place.name} value={place.name}>
                {labelFor(t, "loc.", place.name)}
              </option>
            ))}
          </select>
        </div>

        <div className="ks-fd-actions">
          <button type="submit" className="ks-fd-submit" disabled={submitting}>
            {buttonLabel}
          </button>
        </div>
      </form>
    </>
  );
}

// ---- My Listings ----------------------------------------------------------
function FarmerMatchCard({
  matchResult,
  listing,
  t,
  lang,
  onContactBuyer,
  contactBusy,
  contactError,
}) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  if (!matchResult) {
    return null;
  }

  const groups = matchResult.groups || [];
  const unit = labelFor(t, "unit.", listing.unit);
  const unitOne = labelFor(t, "unitOne.", listing.unit);

  if (groups.length === 0 || matchResult.status === "none") {
    const explanationLines = getDemandMatchExplanation(matchResult, lang, t);
    return (
      <div className="ks-fd-match-box">
        <div className="ks-fd-match-top">
          <span className="ks-fd-match-heading">Buyer Demand Match</span>
          <span className="ks-fd-status ks-fd-badge-none">No Match</span>
        </div>
        <div className="ks-fd-match-stats">
          <div className="ks-fd-match-stat">
            <span className="ks-fd-match-stat-label">Farmer Listing Quantity:</span>
            <span className="ks-fd-match-stat-val">
              {listing.quantity} {unit}
            </span>
          </div>
          <div className="ks-fd-match-stat">
            <span className="ks-fd-match-stat-label">Available Demand:</span>
            <span className="ks-fd-match-stat-val">
              {matchResult.availableQuantity} {unit}
            </span>
          </div>
        </div>
        {explanationLines.length > 0 && (
          <ul className="ks-fd-match-lines">
            {explanationLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const group = groups[activeGroupIndex] || groups[0];
  const isRecommended = group.rank === 1;

  // Short explanation of why the group is recommended
  let shortExplanation = "";
  if (isRecommended) {
    if (groups.length > 1 && groups[1]) {
      const g0 = groups[0];
      const g1 = groups[1];
      if (
        g0.avgOfferPrice !== null &&
        g1.avgOfferPrice !== null &&
        g0.avgOfferPrice > g1.avgOfferPrice + 0.01
      ) {
        shortExplanation = `Recommended because buyers offer a higher average price (₹${g0.avgOfferPrice} vs ₹${g1.avgOfferPrice} per ${unitOne}).`;
      } else if (g0.matchedQuantity > g1.matchedQuantity) {
        shortExplanation = `Recommended because it fulfills a larger portion of your listing quantity (${g0.matchedQuantity} vs ${g1.matchedQuantity} ${unit}).`;
      } else if (g0.participantCount < g1.participantCount) {
        shortExplanation = `Recommended because it requires fewer buyer transactions (${g0.participantCount} vs ${g1.participantCount} buyer${g1.participantCount > 1 ? "s" : ""}).`;
      } else if (
        g0.avgDistanceKm !== null &&
        g1.avgDistanceKm !== null &&
        g0.avgDistanceKm < g1.avgDistanceKm - 0.5
      ) {
        shortExplanation = `Recommended because buyers are located closer (~${g0.avgDistanceKm} km vs ~${g1.avgDistanceKm} km).`;
      } else {
        shortExplanation = "Recommended because it provides better overall match value.";
      }
    } else {
      shortExplanation = "Recommended buyer group based on demand quantity, price, and location.";
    }
  } else {
    shortExplanation = "Alternative buyer group option ranked by matchEngine.";
  }

  const explanationLines = getDemandMatchExplanation(matchResult, lang, t);

  let statusBadgeClass = "ks-fd-badge-none";
  let statusText = "No Match";
  if (group.status === "complete" || group.coverage >= 1 - 1e-6) {
    statusBadgeClass = "ks-fd-badge-complete";
    statusText = "Complete Match";
  } else {
    statusBadgeClass = "ks-fd-badge-partial";
    statusText = "Partial Match";
  }

  return (
    <div className="ks-fd-match-box">
      <div className="ks-fd-match-top">
        <span className="ks-fd-match-heading">Buyer Demand Match</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span className={`ks-fd-status ${statusBadgeClass}`}>{statusText}</span>
          {isRecommended ? (
            <span className="ks-fd-badge-recommended">⭐ Recommended Buyer Group</span>
          ) : (
            <span className="ks-fd-badge-option">Group {group.rank}</span>
          )}
        </div>
      </div>

      {groups.length > 1 && (
        <div className="ks-fd-match-tabs">
          {groups.map((g, idx) => (
            <button
              key={g.id || idx}
              type="button"
              className={`ks-fd-match-tab ${idx === activeGroupIndex ? "active" : ""}`}
              onClick={() => setActiveGroupIndex(idx)}
            >
              {g.rank === 1 ? "⭐ Group 1 (Recommended)" : `Group ${g.rank}`}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats: Listing Qty, Quantity Matched, Expected Price, Total Value */}
      <div className="ks-fd-price-box">
        <div className="ks-fd-row" style={{ marginBottom: "4px" }}>
          <span className="ks-fd-row-label">Farmer Listing Quantity:</span>
          <span className="ks-fd-row-value">{listing.quantity} {unit}</span>
        </div>
        <div className="ks-fd-row" style={{ marginBottom: "4px" }}>
          <span className="ks-fd-row-label">Quantity Matched:</span>
          <span className="ks-fd-row-value" style={{ color: "#111827" }}>
            {group.matchedQuantity} {unit} ({Math.round(group.coverage * 100)}%)
          </span>
        </div>
        <div className="ks-fd-row" style={{ marginBottom: "4px" }}>
          <span className="ks-fd-row-label">Farmer Expected Price:</span>
          <span className="ks-fd-row-value" style={{ color: "#166534" }}>
            {t("price.perUnit", { price: listing.expected_price, unit: unitOne })}
          </span>
        </div>
        <div className="ks-fd-row">
          <span className="ks-fd-row-label">Estimated Total Value:</span>
          <span className="ks-fd-row-value" style={{ fontSize: "15px", color: "#111827" }}>
            {group.totalPrice !== null ? `₹${group.totalPrice.toLocaleString()}` : "N/A"}
            {group.maxTotal !== null && group.maxTotal !== group.totalPrice
              ? ` (Buyers offer up to ₹${group.maxTotal.toLocaleString()})`
              : ""}
          </span>
        </div>
      </div>

      {/* Short explanation */}
      {shortExplanation && (
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: isRecommended ? "#166534" : "#4b5563",
            margin: "8px 0",
            padding: "6px 10px",
            background: isRecommended ? "#e8f5e9" : "#f3f4f6",
            borderRadius: "6px",
          }}
        >
          {shortExplanation}
        </div>
      )}

      {/* Explanation lines from matchExplain */}
      {explanationLines.length > 0 && isRecommended && (
        <ul className="ks-fd-match-lines">
          {explanationLines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      )}

      {/* Contributing Buyers */}
      {group.participants && group.participants.length > 0 && (
        <div className="ks-fd-match-buyers">
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>
            Contributing Buyers ({group.participants.length}):
          </div>
          {group.participants.map((p) => (
            <div key={p.id} className="ks-fd-match-buyer-card">
              <div>
                <div className="ks-fd-match-buyer-name">
                  {p.name || t("fm.demand") || "Buyer"}
                </div>
                <div className="ks-fd-match-buyer-sub">
                  {p.location ? `${labelFor(t, "loc.", p.location)} · ` : ""}
                  Matched Quantity: <strong>{p.quantity} {unit}</strong>
                  {p.isPartialOfItem ? ` (of ${p.offeredQuantity} ${unit} requested)` : ""}
                  {p.distanceKm !== null ? ` · ~${p.distanceKm} km` : ""}
                  {p.offerPrice !== null && (
                    <span> · Buyer Max Price: <strong>₹{p.offerPrice}/{unitOne}</strong></span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="ks-fd-match-buyer-btn"
                onClick={() => onContactBuyer(p.id)}
                disabled={contactBusy !== null}
              >
                {contactBusy === p.id ? t("chat.opening") : (t("fm.req.contact") || "Contact Buyer")}
              </button>
            </div>
          ))}
        </div>
      )}

      {contactError && contactBusy && (
        <p className="ks-fd-alert ks-fd-alert-error" style={{ marginTop: 8 }}>
          {contactError}
        </p>
      )}
    </div>
  );
}

function ListingsSection({
  listings,
  loading,
  error,
  message,
  deletingId,
  onDelete,
  onAddProduce,
  listingMatches,
  onContactBuyer,
  contactBusy,
  contactError,
}) {
  const { t, lang } = useI18n();
  const dateLocale = lang === "kn" ? "kn-IN" : "en-GB";
  return (
    <>
      <SectionHeader
        title={t("list.title")}
        subtitle={t("list.subtitle")}
        demo={false}
      />

      {error && (
        <div className="ks-fd-alert ks-fd-alert-error" role="alert">
          {t(error.key, { detail: error.detail || t("common.unknownError") })}
        </div>
      )}

      {message && (
        <div
          className={"ks-fd-alert ks-fd-alert-" + message.type}
          role={message.type === "error" ? "alert" : "status"}
        >
          {renderMessage(t, message)}
        </div>
      )}

      {loading ? (
        <div className="ks-fd-alert ks-fd-alert-info">{t("list.loading")}</div>
      ) : listings.length === 0 && !error ? (
        <div className="ks-fd-empty">
          {t("list.empty")}
          <div>
            <button type="button" onClick={onAddProduce}>
              {t("nav.add")}
            </button>
          </div>
        </div>
      ) : (
        <div className="ks-fd-list">
          {listings.map((item) => {
            const matchResult = listingMatches ? listingMatches.get(item.id) : null;
            return (
              <InfoCard
                key={item.id}
                title={item.product_name}
                photoUrl={item.photo_url || ""}
                status={item.status === "active" ? t("status.active") : item.status}
                rows={[
                  {
                    label: t("list.quantity"),
                    value: `${item.quantity} ${labelFor(t, "unit.", item.unit)}`,
                  },
                  {
                    label: t("list.price"),
                    value: t("price.perUnit", {
                      price: item.expected_price,
                      unit: labelFor(t, "unitOne.", item.unit),
                    }),
                  },
                  {
                    label: t("list.location"),
                    value: labelFor(t, "loc.", item.location),
                  },
                  {
                    label: t("list.available"),
                    value: formatDate(
                      item.available_date,
                      dateLocale,
                      t("common.notSet")
                    ),
                  },
                ]}
                actions={
                  <button
                    type="button"
                    className="ks-fd-delete"
                    onClick={() => onDelete(item)}
                    disabled={deletingId !== null}
                  >
                    {deletingId === item.id ? t("list.deleting") : t("list.delete")}
                  </button>
                }
              >
                <FarmerMatchCard
                  matchResult={matchResult}
                  listing={item}
                  t={t}
                  lang={lang}
                  onContactBuyer={onContactBuyer}
                  contactBusy={contactBusy}
                  contactError={contactError}
                />
              </InfoCard>
            );
          })}
        </div>
      )}
    </>
  );
}

function PricesSection() {
  const { t, lang } = useI18n();
  const [commodity, setCommodity] = useState("");
  const [stateFilter, setStateFilter] = useState("Karnataka");
  const [districtFilter, setDistrictFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [submittedCommodity, setSubmittedCommodity] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const searchInFlight = useRef(false);

  const runSearch = async (event) => {
    event.preventDefault();
    const term = commodity.trim();
    if (!term) {
      setError(t("prices.commodityRequired"));
      return;
    }
    if (searchInFlight.current || loading) {
      return;
    }

    searchInFlight.current = true;
    setLoading(true);
    setError("");
    setRows([]);
    setSearched(true);
    setSubmittedCommodity(term);

    try {
      const { rows: data, error: queryError } = await searchMarketPrices({
        commodity: term,
        state: stateFilter,
        district: districtFilter,
        market: marketFilter,
      });
      if (queryError) {
        throw queryError;
      }
      setRows(data);
    } catch (err) {
      setError(
        t("prices.error", {
          detail: err && err.message ? err.message : t("common.unknownError"),
        })
      );
    } finally {
      setLoading(false);
      searchInFlight.current = false;
    }
  };

  return (
    <>
      <SectionHeader
        title={t("prices.title")}
      />

      <form className="ks-fd-price-search" onSubmit={runSearch}>
        <h3 className="ks-fd-searchbar-title">{t("prices.searchTitle")}</h3>

        <div className="ks-fd-field" style={{ marginTop: 12 }}>
          <label className="ks-fd-label" htmlFor="ks-fd-price-commodity">
            {t("prices.commodity")}
          </label>
          <input
            id="ks-fd-price-commodity"
            className="ks-fd-input"
            type="text"
            value={commodity}
            placeholder={t("prices.commodityPlaceholder")}
            onChange={(event) => setCommodity(event.target.value)}
          />
        </div>

        <div className="ks-fd-price-filters">
          <div className="ks-fd-field">
            <label className="ks-fd-label" htmlFor="ks-fd-price-state">
              {t("prices.state")}
            </label>
            <select
              id="ks-fd-price-state"
              className="ks-fd-input"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              <option value="">{t("prices.allStates")}</option>
              <option value="Karnataka">{t("prices.stateDefault")}</option>
            </select>
          </div>
          <div className="ks-fd-field">
            <label className="ks-fd-label" htmlFor="ks-fd-price-district">
              {t("prices.district")}
            </label>
            <select
              id="ks-fd-price-district"
              className="ks-fd-input"
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
            >
              <option value="">{t("fm.search.allLocations")}</option>
              {KARNATAKA_DISTRICTS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="ks-fd-field" style={{ gridColumn: "1 / -1" }}>
            <label className="ks-fd-label" htmlFor="ks-fd-price-market">
              {t("prices.market")}
            </label>
            <input
              id="ks-fd-price-market"
              className="ks-fd-input"
              type="text"
              value={marketFilter}
            placeholder={t("prices.marketPlaceholder")}
              onChange={(event) => setMarketFilter(event.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="ks-fd-search-btn"
          style={{ marginTop: 14 }}
          disabled={loading}
        >
          {loading ? t("prices.searching") : t("prices.searchButton")}
        </button>
      </form>

      {loading && (
        <p className="ks-fd-price-status ks-fd-price-status--muted">
          {t("prices.loading")}
        </p>
      )}

      {error && (
        <p className="ks-fd-price-status ks-fd-price-status--error">{error}</p>
      )}

      {!loading && searched && !error && rows.length === 0 && (
        <p className="ks-fd-price-status ks-fd-price-status--muted">
          {t("prices.empty")}
        </p>
      )}

      {!loading && rows.length > 0 && (
        <>
          <p className="ks-fd-price-status">
            {t("prices.resultsFor", {
              commodity:
                lang === "kn"
                  ? rows[0].commodity_kn || rows[0].commodity || submittedCommodity
                  : rows[0].commodity || submittedCommodity,
            })}
          </p>
          <div className="ks-fd-price-table-wrap">
            <table className="ks-fd-price-table">
              <thead>
                <tr>
                  <th>{t("prices.colMarket")}</th>
                  <th>{t("prices.colDistrict")}</th>
                  <th>{t("prices.colVariety")}</th>
                  <th>{t("prices.colMin")}</th>
                  <th>{t("prices.colMax")}</th>
                  <th>{t("prices.colModal")}</th>
                  <th>{t("prices.colUnit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{lang === "kn" ? row.market_kn || row.market : row.market}</td>
                    <td>{lang === "kn" ? row.district_kn || row.district : row.district}</td>
                    <td>{lang === "kn" ? row.variety_kn || row.variety || "—" : row.variety || "—"}</td>
                    <td>{formatPriceInr(row.min_price)}</td>
                    <td>{formatPriceInr(row.max_price)}</td>
                    <td>{formatPriceInr(row.modal_price)}</td>
                    <td>{row.unit ? labelFor(t, "prices.unit.", row.unit) : t("prices.unitUnknown")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// Buyer Requests: search buyer requirements, see them on the map, Contact Buyer
function RequestsSection({ user, presetFilters, onOpenChat }) {
  const { t, lang } = useI18n();
  return (
    <>
      <SectionHeader
        title={t("req.title")}
        subtitle={t("req.subtitle")}
        demo={false}
      />
      <FarmerMarketplace
        user={user}
        lang={lang}
        mode="search"
        initialFilters={presetFilters}
        onOpenChat={onOpenChat}
      />
    </>
  );
}

// Market Opportunities: GoogleMarketMap shows genuine marketplace records and
// only evidence-verified mandi opportunities.
function OpportunitiesSection({ user, onOpenChat }) {
  const { t, lang } = useI18n();
  return (
    <>
      <FarmerMarketplace user={user} lang={lang} mode="map" onOpenChat={onOpenChat} />
      <p className="ks-fd-footnote">{t("map.footnote")}</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function FarmerDashboard() {
  // Which section is visible. UI only: no routing library is used.
  const [activeNav, setActiveNav] = useState("home");

  // Selected language (English / Kannada) lives in React state
  const [lang, setLangState] = useState(readSavedLanguage);
  const setLang = (code) => {
    setLangState(code);
    saveLanguage(code);
  };
  const t = useCallback((key, params) => translate(lang, key, params), [lang]);
  const i18n = useMemo(() => ({ lang: lang, t: t }), [lang, t]);

  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [profileName, setProfileName] = useState("");

  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");

  const [loggingOut, setLoggingOut] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [listingsMessage, setListingsMessage] = useState(null); // { type, text }

  // Marketplace: buyer-request count, Home search, and the open chat
  const [buyerRequestCount, setBuyerRequestCount] = useState(null);
  const [presetFilters, setPresetFilters] = useState(null); // { product, location, nonce }
  const [openConversationId, setOpenConversationId] = useState(null);

  // Demand matching: active buyer requirements & buyer profiles
  const [requirements, setRequirements] = useState([]);
  const [buyerNames, setBuyerNames] = useState({});
  const [contactBusy, setContactBusy] = useState(null);
  const [contactError, setContactError] = useState("");

  // Load the logged-in user, then their profile (profile failure is non-fatal)
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data || !data.user) {
          setUser(null);
          return;
        }
        setUser(data.user);

        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", data.user.id)
            .maybeSingle();
          if (!cancelled && !profileError && profile && profile.full_name) {
            setProfileName(profile.full_name);
          }
        } catch (profileErr) {
          // keep the "Farmer" fallback
        }
      } catch (err) {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch this farmer's listings
  const loadListings = useCallback(async (userId) => {
    if (!userId) return;
    setListingsLoading(true);
    setListingsError("");
    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("farmer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setListings(data || []);
    } catch (err) {
      setListingsError({
        key: "msg.loadListingsFailed",
        detail: err && err.message ? err.message : "",
      });
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadListings(user.id);
    } else if (!userLoading) {
      setListingsLoading(false);
    }
  }, [user, userLoading, loadListings]);

  // Load active buyer requirements for matching
  const loadRequirements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("buyer_requirements")
        .select(REQ_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data || [];
      setRequirements(rows);
      setBuyerRequestCount(rows.length);

      const buyerIds = Array.from(
        new Set(rows.map((row) => row.buyer_id).filter(Boolean))
      );
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", buyerIds);
        if (profiles) {
          const names = {};
          profiles.forEach((p) => {
            if (p.full_name) names[p.id] = p.full_name;
          });
          setBuyerNames(names);
        }
      }
    } catch (err) {
      console.error("Could not load buyer requirements:", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadRequirements();
    }
  }, [user, loadRequirements]);

  // Refresh buyer requirements whenever listings or home become active
  useEffect(() => {
    if (user && (activeNav === "listings" || activeNav === "home")) {
      loadRequirements();
    }
  }, [user, activeNav, loadRequirements]);

  // Real number of active buyer requirements (Home page)
  useEffect(() => {
    if (!user || activeNav !== "home") return undefined;
    let cancelled = false;

    async function loadBuyerRequestCount() {
      try {
        const { count, error } = await supabase
          .from("buyer_requirements")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");
        if (cancelled) return;
        setBuyerRequestCount(error ? 0 : count || 0);
      } catch (err) {
        if (!cancelled) setBuyerRequestCount(0);
      }
    }

    loadBuyerRequestCount();
    return () => {
      cancelled = true;
    };
  }, [user, activeNav]);

  // Home search -> Buyer Requests page with the search applied
  const handleSearchBuyers = (product, location) => {
    setPresetFilters({ product: product, location: location, nonce: Date.now() });
    setActiveNav("requests");
  };

  // "Contact Buyer" -> open the Messages page on that conversation
  const handleOpenChat = (conversationId) => {
    setOpenConversationId(conversationId);
    setActiveNav("messages");
  };

  // Clear the delete message when leaving My Listings
  useEffect(() => {
    if (activeNav !== "listings") {
      setListingsMessage(null);
    }
  }, [activeNav]);

  const handleDeleteListing = async (listing) => {
    if (!user || deletingId !== null) return;

    const confirmed = window.confirm(
      t("msg.deleteConfirm", {
        name: listing.product_name,
        quantity: listing.quantity,
        unit: labelFor(t, "unit.", listing.unit),
        location: labelFor(t, "loc.", listing.location),
      })
    );
    if (!confirmed) return;

    setDeletingId(listing.id);
    setListingsMessage(null);

    try {
      // Only the current farmer's own listing can match: id AND farmer_id.
      // .select("id") returns the deleted rows, so a delete that matched
      // nothing (missing row or blocked by a policy) is not reported as success.
      const { data, error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listing.id)
        .eq("farmer_id", user.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw i18nError("msg.deleteNothing");
      }

      // Remove it from the UI immediately (Home count updates too)
      setListings((prev) => prev.filter((item) => item.id !== listing.id));
      setListingsMessage({ type: "success", key: "msg.deleted" });
    } catch (err) {
      if (err && err.i18nKey) {
        setListingsMessage({ type: "error", key: err.i18nKey });
      } else {
        setListingsMessage({
          type: "error",
          key: "msg.deleteFailed",
          detail: err && err.message ? err.message : "",
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // App.jsx detects the missing session and shows the Auth page.
    } catch (err) {
      setLoggingOut(false);
      window.alert(
        t("msg.logoutFailed", {
          detail: (err && err.message) || t("common.unknownError"),
        })
      );
    }
  };

  const farmerName = profileName || t("header.farmer");

  // Normalized buyer requirements for demand matching
  const normalizedRequirements = useMemo(() => {
    return requirements.map((req) =>
      normalizeRequirement(req, {
        coords: resolveCoords(req),
        name: buyerNames[req.buyer_id] || "",
      })
    );
  }, [requirements, buyerNames]);

  // Compute demand matches for each of the farmer's listings
  const listingMatches = useMemo(() => {
    const matches = new Map();
    listings.forEach((listing) => {
      const normListing = normalizeListing(listing, {
        coords: resolveCoords(listing),
        name: farmerName,
      });
      const result = findDemandMatches(normListing, normalizedRequirements);
      matches.set(listing.id, result);
    });
    return matches;
  }, [listings, normalizedRequirements, farmerName]);

  const handleContactBuyer = async (requirementId) => {
    if (contactBusy) return;
    setContactBusy(requirementId);
    setContactError("");
    try {
      const conversationId = await startConversation({ requirementId: requirementId });
      handleOpenChat(conversationId);
    } catch (error) {
      console.error("Could not start conversation:", error);
      setContactError(
        isMessagingNotSetUp(error)
          ? t("chat.notSetUp")
          : t("chat.contactFailed", { detail: error && error.message ? error.message : "unknown error" })
      );
    } finally {
      setContactBusy(null);
    }
  };

  const activeListingCount = listings.filter((l) => l.status === "active").length;
  const activeItem = NAV_ITEMS.find((item) => item.id === activeNav);

  if (userLoading) {
    return <div className="ks-fd-loading">{t("common.loadingDashboard")}</div>;
  }

  let content;
  if (activeNav === "add") {
    content = (
      <AddProduceSection
        user={user}
        onCreated={async () => {
          await loadListings(user.id);
          await loadRequirements();
        }}
      />
    );
  } else if (activeNav === "listings") {
    content = (
      <ListingsSection
        listings={listings}
        loading={listingsLoading}
        error={listingsError}
        message={listingsMessage}
        deletingId={deletingId}
        onDelete={handleDeleteListing}
        onAddProduce={() => setActiveNav("add")}
        listingMatches={listingMatches}
        onContactBuyer={handleContactBuyer}
        contactBusy={contactBusy}
        contactError={contactError}
      />
    );
  } else if (activeNav === "prices") {
    content = <PricesSection />;
  } else if (activeNav === "opportunities") {
    content = <OpportunitiesSection user={user} onOpenChat={handleOpenChat} />;
  } else if (activeNav === "requests") {
    content = (
      <RequestsSection
        user={user}
        presetFilters={presetFilters}
        onOpenChat={handleOpenChat}
      />
    );
  } else if (activeNav === "messages") {
    content = (
      <MessagesCenter
        user={user}
        lang={lang}
        initialConversationId={openConversationId}
        accent="#14532d"
      />
    );
  } else {
    content = (
  <HomeSection
    onNavigate={setActiveNav}
    farmerName={farmerName}
    activeListingCount={activeListingCount}
    listingsLoading={listingsLoading}
    buyerRequestCount={buyerRequestCount}
    onSearchBuyers={handleSearchBuyers}
  />
    );
  }

  return (
    <I18nContext.Provider value={i18n}>
    <div className="ks-fd" lang={lang}>
      <style>{DASHBOARD_CSS}</style>

      <aside className="ks-fd-side">
        <div className="ks-fd-brand">
          <img className="ks-brand-logo" src="/krishi-samparka-logo.jpeg" alt="" />
          <span className="ks-fd-brand-copy">
            <span className="ks-fd-brand-name">Krishi Samparka</span>
            <span className="ks-brand-local" lang="kn">ಕೃಷಿ ಸಂಪರ್ಕ</span>
          </span>
        </div>

        <nav className="ks-fd-nav" aria-label={t("nav.main")}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ks-fd-nav-item"
              aria-current={activeNav === item.id ? "page" : undefined}
              onClick={() => setActiveNav(item.id)}
            >
              <Icon name={item.icon} size={18} />
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="ks-fd-main">
        <header className="ks-fd-header">
          <p className="ks-fd-header-title">
            {t("header.dashboard")}
            {activeItem && activeNav !== "home" ? " / " + t(activeItem.labelKey) : ""}
          </p>

          <div className="ks-fd-header-right">
            <select
              className="ks-fd-lang"
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              aria-label={t("lang.label")}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="ks-fd-profile">
              <span className="ks-fd-avatar">
                <Icon name="user" size={18} />
              </span>
              <span className="ks-fd-profile-text">
                <div className="ks-fd-profile-name">{farmerName}</div>
                <div className="ks-fd-profile-role">{t("header.role")}</div>
              </span>
            </div>

            <button
              type="button"
              className="ks-fd-logout"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <Icon name="logout" size={16} />
              {loggingOut ? t("header.loggingOut") : t("header.logout")}
            </button>
          </div>
        </header>

        {content}
      </main>
    </div>
    </I18nContext.Provider>
  );
}

export default FarmerDashboard;
