import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// NOTE: if your config/supabase.js uses a default export, change this to:
//   import supabase from "../config/supabase";
import { supabase } from "../config/supabase";
import { GoogleMarketMap } from "../components/Map/GoogleMarketMap";
import MessagesCenter from "../components/Messaging/MessagesCenter";
import {
  startConversation,
  isMessagingNotSetUp,
} from "../components/Messaging/messagingApi";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  translate,
} from "../i18n/translations";
import {
  LISTING_COLUMNS,
  REQ_COLUMNS,
  REQ_PUBLIC_COLUMNS,
  UNIT_VALUES,
  LOCATION_VALUES,
  readSavedLanguage,
  saveLanguage,
  hasValue,
  findCoordinates,
  resolveCoords,
  errorText,
  upsertRow,
  formatDate,
} from "../utils/marketplaceData";
import {
  findSupplyMatches,
  normalizeRequirement,
  normalizeListing,
} from "../utils/matchEngine";
import { explainMatch } from "../utils/matchExplain";

// ---------------------------------------------------------------------------
// Database columns used (see utils/marketplaceData.js)
//   public.listings:           id, farmer_id, product_name, photo_url, quantity,
//                              unit, expected_price, available_date, location,
//                              latitude, longitude, status, created_at
//   public.profiles:          id, full_name
//   public.buyer_requirements: id, buyer_id, product_name, quantity, unit,
//                              max_price, required_date, location, latitude,
//                              longitude, status, created_at, updated_at
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: "home", key: "buyer.nav.home", fallback: "Home", icon: "home" },
  { id: "search", key: "buyer.nav.search", fallback: "Find Farmers", icon: "search" },
  { id: "create", key: "buyer.nav.create", fallback: "Create Requirement", icon: "plus" },
  { id: "requirements", key: "buyer.nav.requirements", fallback: "My Requirements", icon: "list" },
  { id: "messages", key: "buyer.nav.messages", fallback: "Messages", icon: "chat" },
];

// ---------------------------------------------------------------------------
// Styles (scoped with the "ks-bd" prefix)
// ---------------------------------------------------------------------------
const CSS = `
.ks-bd { min-height: 100vh; display: flex; background: #f4f9f4; color: #1f2937;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Kannada", sans-serif; text-align: left; }
.ks-bd *, .ks-bd *::before, .ks-bd *::after { box-sizing: border-box; }
.ks-bd button, .ks-bd input, .ks-bd select { font-family: inherit; }
.ks-bd-side { width: 230px; flex-shrink: 0; background: #fff; border-right: 1px solid #e3ece3;
  padding: 20px 14px; display: flex; flex-direction: column; gap: 20px; }
.ks-bd-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.ks-bd-brand-icon { width: 36px; height: 36px; border-radius: 10px; background: #e8f5e9; color: #166534;
  display: flex; align-items: center; justify-content: center; }
.ks-bd-brand-name { font-size: 18px; font-weight: 700; color: #14532d; }
.ks-bd-nav { display: flex; flex-direction: column; gap: 4px; }
.ks-bd-nav-item { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 12px;
  border: none; border-radius: 10px; background: transparent; color: #374151; font-size: 14px;
  cursor: pointer; text-align: left; }
.ks-bd-nav-item:hover { background: #f0f7f0; }
.ks-bd-nav-item[aria-current="page"] { background: #14532d; color: #fff; font-weight: 600; }
.ks-bd-main { flex: 1; min-width: 0; padding: 20px 28px 40px; }
.ks-bd-header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 22px; }
.ks-bd-header-title { font-size: 14px; color: #6b7280; margin: 0; }
.ks-bd-header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ks-bd-lang { display: flex; gap: 6px; }
.ks-bd-lang-btn { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid #cfdccf;
  background: #fff; color: #374151; font-size: 13px; cursor: pointer; }
.ks-bd-lang-btn[aria-pressed="true"] { background: #166534; border-color: #166534; color: #fff; font-weight: 600; }
.ks-bd-profile { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; background: #fff;
  border: 1px solid #e3ece3; border-radius: 999px; }
.ks-bd-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; color: #1d4ed8;
  display: flex; align-items: center; justify-content: center; }
.ks-bd-profile-name { font-size: 13px; font-weight: 600; line-height: 1.2; }
.ks-bd-profile-role { font-size: 11px; color: #6b7280; }
.ks-bd-logout { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px;
  border: 1px solid #cfdccf; border-radius: 10px; background: #fff; color: #374151; font-size: 14px;
  font-weight: 600; cursor: pointer; }
.ks-bd-logout:disabled { opacity: 0.6; cursor: not-allowed; }
.ks-bd-welcome h1 { margin: 0; font-size: 28px; line-height: 1.2; color: #111827; }
.ks-bd-welcome p { margin: 6px 0 18px; font-size: 15px; color: #4b5563; max-width: 640px; }
.ks-bd-hero { background: linear-gradient(135deg, #1e3a8a, #1f2937); color: #fff; border-radius: 20px;
  padding: 20px 24px; margin-bottom: 18px; }
.ks-bd-hero-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
.ks-bd-hero-stats { display: flex; flex-wrap: wrap; gap: 28px; margin-top: 10px; }
.ks-bd-hero-value { font-size: 28px; font-weight: 700; color: #bfdbfe; }
.ks-bd-hero-caption { font-size: 12px; opacity: 0.8; }
.ks-bd-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 20px; }
.ks-bd-card { display: flex; align-items: center; gap: 14px; padding: 18px; background: #fff;
  border: 1px solid #e3ece3; border-radius: 16px; text-align: left; color: inherit; cursor: pointer; }
.ks-bd-card:hover { border-color: #86efac; background: #fbfefb; }
.ks-bd-card-icon { width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: #e8f5e9;
  color: #166534; display: flex; align-items: center; justify-content: center; }
.ks-bd-card-title { display: block; font-size: 15px; font-weight: 700; color: #111827; }
.ks-bd-card-desc { display: block; font-size: 13px; color: #6b7280; margin-top: 2px; }
.ks-bd-head { margin-bottom: 14px; }
.ks-bd-head h1 { margin: 0; font-size: 24px; color: #111827; }
.ks-bd-head p { margin: 4px 0 0; font-size: 14px; color: #4b5563; max-width: 640px; }
.ks-bd-panel { background: #fff; border: 1px solid #e3ece3; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
.ks-bd-searchbar { display: grid; grid-template-columns: 1.4fr 1fr auto; gap: 10px; align-items: end; }
.ks-bd-field { margin-bottom: 12px; }
.ks-bd-searchbar .ks-bd-field { margin-bottom: 0; }
.ks-bd-label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #374151; }
.ks-bd-input { width: 100%; min-height: 46px; padding: 8px 12px; border: 1.5px solid #c9d6c9; border-radius: 12px;
  background: #fff; color: #111827; font-size: 16px; }
.ks-bd-input:focus { border-color: #16a34a; }
.ks-bd-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ks-bd-btn { min-height: 46px; padding: 0 20px; border: none; border-radius: 12px; background: #16a34a;
  color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; }
.ks-bd-btn:hover { background: #15803d; }
.ks-bd-btn:disabled { background: #86b997; cursor: not-allowed; }
.ks-bd-btn-ghost { background: #fff; color: #374151; border: 1px solid #cfdccf; }
.ks-bd-btn-ghost:hover { background: #f0f7f0; }
.ks-bd-btn-small { min-height: 38px; padding: 0 14px; font-size: 14px; }
.ks-bd-btn-blue { background: #1f6feb; }
.ks-bd-btn-blue:hover { background: #1a5fcb; }
.ks-bd-btn-danger { min-height: 36px; padding: 0 12px; background: #fff; color: #b91c1c; border: 1px solid #fecaca;
  font-size: 13px; }
.ks-bd-btn-danger:hover { background: #fef2f2; }
.ks-bd-msg { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; font-size: 14px; line-height: 1.4; }
.ks-bd-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.ks-bd-msg-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.ks-bd-msg-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
.ks-bd-split { display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: start; }
.ks-bd-results-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111827; }
.ks-bd-list { display: grid; gap: 10px; }
.ks-bd-item { background: #fff; border: 1px solid #e3ece3; border-left: 5px solid #2e9e4f; border-radius: 14px;
  padding: 12px 14px; text-align: left; color: inherit; width: 100%; cursor: pointer; }
.ks-bd-item:hover { background: #fbfefb; }
.ks-bd-item[aria-pressed="true"] { border-color: #16a34a; background: #f0fdf4; }
.ks-bd-item-static { cursor: default; border-left-color: #1f6feb; }
.ks-bd-item-static:hover { background: #fff; }
.ks-bd-item-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 6px; }
.ks-bd-item-title { font-size: 16px; font-weight: 700; color: #111827; }
.ks-bd-badge { padding: 2px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; }
.ks-bd-badge-blue { background: #dbeafe; color: #1d4ed8; }
.ks-bd-rows { display: grid; gap: 3px; }
.ks-bd-r { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.ks-bd-r-label { color: #6b7280; }
.ks-bd-r-value { font-weight: 600; text-align: right; }
.ks-bd-detail { border-left: 5px solid #2e9e4f; }
.ks-bd-detail-blue { border-left-color: #1f6feb; }
.ks-bd-detail h2 { margin: 0 0 10px; font-size: 18px; color: #111827; }
.ks-bd-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.ks-bd-detail-head h2 { margin: 0; }
.ks-bd-photo { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 10px; background: #eef2ee; }
.ks-bd-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.ks-bd-note { margin: 10px 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
.ks-bd-map { width: 100%; height: 560px; border: 1px solid #e3ece3; border-radius: 16px; overflow: hidden; background: #fff; }
.ks-bd-map-head { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-wrap: wrap; margin: 4px 0 10px; }
.ks-bd-map-head h2 { margin: 0; font-size: 18px; color: #111827; }
.ks-bd-legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 10px; font-size: 13px; color: #374151; }
.ks-bd-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.25); margin-right: 6px; vertical-align: -1px; }
.ks-bd button:focus-visible, .ks-bd input:focus-visible, .ks-bd select:focus-visible {
  outline: 3px solid #86efac; outline-offset: 2px; }
@media (max-width: 1100px) { .ks-bd-split { grid-template-columns: 1fr; } .ks-bd-map { height: 480px; } }
@media (max-width: 960px) { .ks-bd-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) {
  .ks-bd { flex-direction: column; }
  .ks-bd-side { width: 100%; border-right: none; border-bottom: 1px solid #e3ece3; padding: 12px; }
  .ks-bd-nav { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .ks-bd-nav-item { white-space: nowrap; }
  .ks-bd-main { padding: 16px 14px 32px; }
  .ks-bd-profile-text { display: none; }
  .ks-bd-profile { padding: 4px; }
  .ks-bd-searchbar { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .ks-bd-grid { grid-template-columns: 1fr; }
  .ks-bd-row2 { grid-template-columns: 1fr; }
}
.ks-bd-badge-complete { background: #dcfce7; color: #166534; font-weight: 700; }
.ks-bd-badge-partial { background: #fef3c7; color: #92400e; font-weight: 700; }
.ks-bd-badge-none { background: #f3f4f6; color: #6b7280; font-weight: 600; }
.ks-bd-match-box { margin-top: 14px; padding: 14px; background: #fbfdfb; border: 1px solid #d4e7d4; border-radius: 12px; }
.ks-bd-match-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ks-bd-match-heading { font-size: 14px; font-weight: 700; color: #14532d; }
.ks-bd-match-stats { display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 0; font-size: 13px; }
.ks-bd-match-stat { display: flex; gap: 4px; }
.ks-bd-match-stat-label { color: #6b7280; }
.ks-bd-match-stat-val { font-weight: 600; color: #111827; }
.ks-bd-match-lines { margin: 8px 0 10px; padding-left: 18px; font-size: 13px; color: #374151; line-height: 1.5; }
.ks-bd-match-farmers { display: grid; gap: 8px; margin-top: 10px; }
.ks-bd-match-farmer-card { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e3ece3; border-radius: 10px; flex-wrap: wrap; }
.ks-bd-match-farmer-name { font-weight: 700; font-size: 14px; color: #111827; }
.ks-bd-match-farmer-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.ks-bd-match-farmer-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ks-bd-match-farmer-price { font-size: 13px; font-weight: 600; color: #166534; text-align: right; }
.ks-bd-match-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.ks-bd-match-tab { padding: 4px 10px; border-radius: 8px; border: 1px solid #cfdccf; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; color: #374151; }
.ks-bd-match-tab:hover { background: #f0f7f0; }
.ks-bd-match-tab.active { background: #14532d; color: #fff; border-color: #14532d; }
.ks-bd-badge-recommended { background: #dcfce7; color: #14532d; border: 1px solid #86efac; font-weight: 700; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.ks-bd-badge-option { background: #f3f4f6; color: #374151; font-weight: 600; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.ks-bd-price-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
.ks-bd-price-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
`;

// ---------------------------------------------------------------------------
// Icons (inline, no library)
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  leaf: [
    "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z",
    "M2 21c0-3 1.9-5.4 5-6",
  ],
  home: ["M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
  plus: ["M12 5v14", "M5 12h14"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  chevron: ["M9 6l6 6-6 6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  refresh: [
    "M21 12a9 9 0 1 1-3-6.7",
    "M21 3v6h-6",
  ],
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
// Helpers
// ---------------------------------------------------------------------------
function fillParams(text, params) {
  if (!params) {
    return text;
  }
  return String(text).replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : match
  );
}

function getMatchExplanation(result, lang, productLabel, unitLabel) {
  if (!result) {
    return [];
  }
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
  const unit = unitLabel(result.displayUnit);
  const prod = productLabel(result.anchor.productName);
  const best = result.best;

  if (!best || result.status === "none") {
    fallbackLines.push(
      result.availableQuantity > 0
        ? `Found ${result.availableQuantity} ${unit} of ${prod} available, but not enough to meet criteria.`
        : `No matching farmer listings currently found for ${prod}.`
    );
    return fallbackLines;
  }

  const count = best.participantCount;
  if (result.status === "complete") {
    if (count === 1) {
      const farmerName = best.participants[0].name || "Farmer";
      fallbackLines.push(
        `Complete match: 100% covered by ${farmerName} (${best.matchedQuantity} ${unit} ${prod}).`
      );
    } else {
      fallbackLines.push(
        `Complete match: 100% covered across ${count} farmers (${best.matchedQuantity} ${unit} ${prod}).`
      );
    }
  } else {
    fallbackLines.push(
      `Partial match: ${best.matchedQuantity} of ${result.required} ${unit} ${prod} covered across ${count} farmer${count > 1 ? "s" : ""}.`
    );
  }

  if (best.avgDistanceKm !== null) {
    fallbackLines.push(`Average distance: ~${best.avgDistanceKm} km.`);
  }
  if (best.totalPrice !== null && best.effectivePrice !== null) {
    fallbackLines.push(`Estimated total: ₹${best.totalPrice} (₹${best.effectivePrice} per ${unit}).`);
  }

  return fallbackLines;
}

function BuyerMatchCard({
  matchResult,
  requirement,
  lang,
  productLabel,
  unitLabel,
  locationLabel,
  priceText,
  T,
  handleContactFarmer,
  contactBusy,
  contactError,
}) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  if (!matchResult) {
    return null;
  }

  const groups = matchResult.groups || [];
  const unit = unitLabel(requirement.unit);

  if (groups.length === 0 || matchResult.status === "none") {
    const explanationLines = getMatchExplanation(matchResult, lang, productLabel, unitLabel);
    return (
      <div className="ks-bd-match-box">
        <div className="ks-bd-match-top">
          <span className="ks-bd-match-heading">Farmer Supply Match</span>
          <span className="ks-bd-badge ks-bd-badge-none">No Match</span>
        </div>
        <div className="ks-bd-match-stats">
          <div className="ks-bd-match-stat">
            <span className="ks-bd-match-stat-label">Required:</span>
            <span className="ks-bd-match-stat-val">
              {requirement.quantity} {unit}
            </span>
          </div>
          <div className="ks-bd-match-stat">
            <span className="ks-bd-match-stat-label">Available:</span>
            <span className="ks-bd-match-stat-val">
              {matchResult.availableQuantity} {unit}
            </span>
          </div>
        </div>
        {explanationLines.length > 0 && (
          <ul className="ks-bd-match-lines">
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

  // Short explanation for recommendation / comparison
  let shortExplanation = "";
  if (isRecommended) {
    if (groups.length > 1 && groups[1]) {
      const g0 = groups[0];
      const g1 = groups[1];
      if (
        g0.effectivePrice !== null &&
        g1.effectivePrice !== null &&
        g0.effectivePrice < g1.effectivePrice - 0.01 &&
        g0.matchedQuantity >= g1.matchedQuantity
      ) {
        shortExplanation = "Lower expected price for the same quantity.";
      } else {
        shortExplanation = "Recommended because it provides better overall match value.";
      }
    } else {
      shortExplanation = "Recommended because it provides better overall match value.";
    }
  } else {
    if (groups[0] && groups[0].totalPrice !== null && group.totalPrice !== null) {
      if (group.totalPrice > groups[0].totalPrice) {
        shortExplanation = `Alternative option with higher total cost (₹${group.totalPrice.toLocaleString()} vs ₹${groups[0].totalPrice.toLocaleString()} for recommended).`;
      } else {
        shortExplanation = "Alternative option with lower overall match score.";
      }
    } else {
      shortExplanation = "Alternative match option.";
    }
  }

  const explanationLines = getMatchExplanation(matchResult, lang, productLabel, unitLabel);

  let statusBadgeClass = "ks-bd-badge-none";
  let statusText = "No Match";
  if (group.status === "complete") {
    statusBadgeClass = "ks-bd-badge-complete";
    statusText = "Complete Match";
  } else if (group.status === "partial") {
    statusBadgeClass = "ks-bd-badge-partial";
    statusText = "Partial Match";
  }

  return (
    <div className="ks-bd-match-box">
      <div className="ks-bd-match-top">
        <span className="ks-bd-match-heading">Farmer Supply Match</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span className={`ks-bd-badge ${statusBadgeClass}`}>{statusText}</span>
          {isRecommended ? (
            <span className="ks-bd-badge-recommended">⭐ Recommended Option</span>
          ) : (
            <span className="ks-bd-badge-option">Option {group.rank}</span>
          )}
        </div>
      </div>

      {groups.length > 1 && (
        <div className="ks-bd-match-tabs">
          {groups.map((g, idx) => (
            <button
              key={g.id || idx}
              type="button"
              className={`ks-bd-match-tab ${idx === activeGroupIndex ? "active" : ""}`}
              onClick={() => setActiveGroupIndex(idx)}
            >
              {g.rank === 1 ? "⭐ Option 1 (Recommended)" : `Option ${g.rank}`}
            </button>
          ))}
        </div>
      )}

      {/* Price and Quantity Summary Box */}
      <div className="ks-bd-price-box">
        <div className="ks-bd-price-row" style={{ marginBottom: "4px" }}>
          <span style={{ color: "#4b5563" }}>Farmer Expected Price:</span>
          <span style={{ fontWeight: 700, color: "#166534" }}>
            {group.effectivePrice !== null
              ? priceText(group.effectivePrice, requirement.unit)
              : "Not specified"}
          </span>
        </div>
        <div className="ks-bd-price-row" style={{ marginBottom: "4px" }}>
          <span style={{ color: "#4b5563" }}>Matched Quantity:</span>
          <span style={{ fontWeight: 700, color: "#111827" }}>
            {group.matchedQuantity} {unit} ({Math.round(group.coverage * 100)}% of {requirement.quantity} {unit})
          </span>
        </div>
        <div className="ks-bd-price-row">
          <span style={{ color: "#4b5563" }}>Total Estimated Cost:</span>
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#111827" }}>
            {group.totalPrice !== null ? `₹${group.totalPrice.toLocaleString()}` : "N/A"}
          </span>
        </div>
      </div>

      {/* Recommendation explanation */}
      {shortExplanation && (
        <div
          style={{
            fontSize: "13px",
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
        <ul className="ks-bd-match-lines">
          {explanationLines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      )}

      {/* Contributing Farmers */}
      {group.participants && group.participants.length > 0 ? (
        <div className="ks-bd-match-farmers">
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>
            Contributing Farmers ({group.participants.length}):
          </div>
          {group.participants.map((p) => (
            <div key={p.id} className="ks-bd-match-farmer-card">
              <div>
                <div className="ks-bd-match-farmer-name">
                  {p.name || T("buyer.listing.farmerUnknown", "Name not available")}
                </div>
                <div className="ks-bd-match-farmer-sub">
                  {p.location ? `${locationLabel(p.location)} · ` : ""}
                  Supplies: <strong>{p.quantity} {unit}</strong>
                  {p.isPartialOfItem ? ` (from ${p.offeredQuantity} ${unit} listing)` : ""}
                  {p.distanceKm !== null ? ` · ~${p.distanceKm} km` : ""}
                </div>
              </div>

              <div className="ks-bd-match-farmer-right">
                <div className="ks-bd-match-farmer-price">
                  {hasValue(p.unitPrice)
                    ? priceText(p.unitPrice, requirement.unit)
                    : ""}
                  {p.subtotal !== null && (
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      Total: ₹{p.subtotal.toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="ks-bd-btn ks-bd-btn-small"
                  onClick={() => handleContactFarmer({ id: p.id })}
                  disabled={contactBusy !== null}
                >
                  {contactBusy === p.id
                    ? T("chat.opening", "Opening chat...")
                    : T("buyer.contact.button", "Contact Farmer")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {contactError && contactBusy && (
        <p className="ks-bd-msg ks-bd-msg-error" role="alert" style={{ marginTop: 8 }}>
          {contactError}
        </p>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  product: "",
  quantity: "",
  unit: "",
  maxPrice: "",
  requiredDate: "",
  location: "",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function BuyerDashboard() {
  const [lang, setLang] = useState(readSavedLanguage);
  const [activeNav, setActiveNav] = useState("home");

  const [user, setUser] = useState(null);
  const [buyerName, setBuyerName] = useState("");

  // Farmer listings (active only) + farmer names
  const [listings, setListings] = useState([]);
  const [farmerNames, setFarmerNames] = useState({});
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");

  // Requirements: mapRequirements = all active ones the database lets this
  // user read (blue markers), myRequirements = this buyer's own
  const [mapRequirements, setMapRequirements] = useState([]);
  const [myRequirements, setMyRequirements] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState("");

  // Search (only FILTERS the list; the map never depends on it)
  const [qProduct, setQProduct] = useState("");
  const [qLocation, setQLocation] = useState("");
  const [filters, setFilters] = useState({ product: "", location: "" });

  // The ONE selected item: { type: "listing" | "requirement", id } or null.
  // The details panel and the map highlight both come from this value, so
  // selecting one type always replaces the other.
  const [selected, setSelected] = useState(null);

  // Contact Farmer (private chat)
  const [contactBusy, setContactBusy] = useState(null); // listing id being opened
  const [contactError, setContactError] = useState("");
  const [openConversationId, setOpenConversationId] = useState(null);

  // Create requirement form
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  // My requirements list
  const [deletingId, setDeletingId] = useState(null);
  const [listMessage, setListMessage] = useState(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Text lookup: uses translations.js; the English fallback only prevents a
  // raw key from showing if a key has not been added to translations.js yet.
  const T = (key, fallback, params) => {
    const result = translate(lang, key, params);
    if (result !== key) {
      return result;
    }
    return fillParams(fallback !== undefined ? fallback : key, params);
  };

  const dateLocale = lang === "kn" ? "kn-IN" : "en-GB";
  const unitLabel = (unit) => T("unitOne." + unit, unit || "");
  const locationLabel = (location) => T("loc." + location, location || "");
  const productLabel = (name) => T("crop." + name, name || "");
  const priceText = (price, unit) =>
    T("price.perUnit", "₹{price} per {unit}", { price: price, unit: unitLabel(unit) });

  const changeLanguage = (code) => {
    setLang(code);
    saveLanguage(code);
  };

  // --- Current user -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data && data.session ? data.session.user : null;
        if (cancelled) {
          return;
        }
        setUser(sessionUser);

        if (sessionUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", sessionUser.id)
            .maybeSingle();
          if (!cancelled && profile && profile.full_name) {
            setBuyerName(profile.full_name);
          }
        }
      } catch (error) {
        console.error("Could not load the current user:", error);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Farmer listings + farmer names -------------------------------------
  // Loaded on page load for the whole marketplace: no search is involved.
  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    setListingsError("");
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      const rows = data || [];
      if (!mountedRef.current) {
        return;
      }
      setListings(rows);

      const farmerIds = Array.from(
        new Set(rows.map((row) => row.farmer_id).filter(Boolean))
      );
      if (farmerIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", farmerIds);
        if (profileError) {
          // Names are optional: listings still work without them
          console.error("Could not load farmer names:", profileError);
        } else if (mountedRef.current) {
          const names = {};
          (profiles || []).forEach((profile) => {
            if (profile.full_name) {
              names[profile.id] = profile.full_name;
            }
          });
          setFarmerNames(names);
        }
      }
    } catch (error) {
      console.error("Could not load listings:", error);
      if (mountedRef.current) {
        setListingsError(errorText(error));
      }
    } finally {
      if (mountedRef.current) {
        setListingsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // --- Buyer requirements (all active for the map + my own) ---------------
  const loadRequirements = useCallback(async (userId) => {
    setReqLoading(true);
    setReqError("");
    try {
      const [allResult, mineResult] = await Promise.all([
        supabase
          .from("buyer_requirements")
          .select(REQ_PUBLIC_COLUMNS)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("buyer_requirements")
          .select(REQ_COLUMNS)
          .eq("buyer_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      if (!mountedRef.current) {
        return;
      }

      const problems = [];
      if (allResult.error) {
        console.error("Could not load active requirements:", allResult.error);
        problems.push(errorText(allResult.error));
      } else {
        setMapRequirements(allResult.data || []);
      }
      if (mineResult.error) {
        console.error("Could not load my requirements:", mineResult.error);
        problems.push(errorText(mineResult.error));
      } else {
        setMyRequirements(mineResult.data || []);
      }
      if (problems.length > 0) {
        setReqError(problems[0]);
      }
    } catch (error) {
      console.error("Could not load requirements:", error);
      if (mountedRef.current) {
        setReqError(errorText(error));
      }
    } finally {
      if (mountedRef.current) {
        setReqLoading(false);
      }
    }
  }, []);

  // Load on page load (as soon as the user is known)
  useEffect(() => {
    if (user) {
      loadRequirements(user.id);
    }
  }, [user, loadRequirements]);

  // Reload both layers (used by the refresh button, tab changes and when the
  // browser tab becomes visible again).
  const refreshMarketplace = useCallback(() => {
    loadListings();
    if (user) {
      loadRequirements(user.id);
    }
  }, [user, loadListings, loadRequirements]);

  // Pick up new farmer listings / buyer requirements whenever the buyer comes
  // back to this browser tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshMarketplace();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshMarketplace]);

  // Reload when the buyer moves to a page that shows the map (not on the very
  // first render, because the page-load effects above already fetched).
  const navRefreshReadyRef = useRef(false);
  useEffect(() => {
    if (!navRefreshReadyRef.current) {
      navRefreshReadyRef.current = true;
      return;
    }
    if (activeNav === "home" || activeNav === "search") {
      refreshMarketplace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  // --- Derived data -------------------------------------------------------
  const farmerName = (listing) =>
    farmerNames[listing.farmer_id] || T("buyer.listing.farmerUnknown", "Name not available");

  // SEARCH ONLY FILTERS THIS LIST. It is NOT used for the map.
  const filteredListings = useMemo(() => {
    const product = filters.product.trim().toLowerCase();
    return listings.filter((listing) => {
      if (filters.location && listing.location !== filters.location) {
        return false;
      }
      if (product) {
        const raw = String(listing.product_name || "").toLowerCase();
        const translated = String(productLabel(listing.product_name)).toLowerCase();
        if (!raw.includes(product) && !translated.includes(product)) {
          return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, filters, lang]);

  // The selected farmer listing (only when a listing is the selected type)
  const selectedListing = useMemo(
    () =>
      selected && selected.type === "listing"
        ? listings.find((listing) => listing.id === selected.id) || null
        : null,
    [listings, selected]
  );

  // GREEN markers: EVERY active farmer listing (all of `listings`, never the
  // search-filtered list), with the farmer's name and translated labels.
  const farmerMap = useMemo(() => {
    const items = [];
    let unmapped = 0;
    listings.forEach((listing) => {
      const coords = resolveCoords(listing);
      if (!coords) {
        unmapped += 1;
        return;
      }
      items.push({
        ...listing,
        latitude: coords.latitude,
        longitude: coords.longitude,
        coords_from_region: coords.fromRegion,
        farmer_name: farmerNames[listing.farmer_id] || "",
        // Display values in the current language (used by the map popup)
        product_label: productLabel(listing.product_name),
        unit_label: unitLabel(listing.unit),
        location_label: locationLabel(listing.location),
        price_text: hasValue(listing.expected_price)
          ? priceText(listing.expected_price, listing.unit)
          : "",
      });
    });
    return { items: items, unmapped: unmapped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, farmerNames, lang]);
  const farmerMapItems = farmerMap.items;

  // BLUE markers: every active requirement the user can read: the "all active"
  // result merged with the buyer's own rows (by id). The merge guarantees a
  // requirement the buyer just created is on the map even if the "all active"
  // query is limited by RLS or has not been refetched yet.
  const requirementMap = useMemo(() => {
    const merged = new Map();
    mapRequirements.forEach((row) => {
      if (row && row.id) {
        merged.set(row.id, row);
      }
    });
    myRequirements.forEach((row) => {
      if (row && row.id) {
        merged.set(row.id, { ...(merged.get(row.id) || {}), ...row });
      }
    });

    const items = [];
    let unmapped = 0;
    merged.forEach((row) => {
      if (row.status !== "active") {
        return;
      }
      const coords = resolveCoords(row);
      if (!coords) {
        unmapped += 1;
        return;
      }
      items.push({
        ...row,
        latitude: coords.latitude,
        longitude: coords.longitude,
        coords_from_region: coords.fromRegion,
        is_mine: Boolean(user && row.buyer_id && row.buyer_id === user.id),
        // Display values in the current language (used by the map popup)
        product_label: productLabel(row.product_name),
        unit_label: unitLabel(row.unit),
        location_label: locationLabel(row.location),
        price_text: hasValue(row.max_price) ? priceText(row.max_price, row.unit) : "",
      });
    });
    return { items: items, unmapped: unmapped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRequirements, myRequirements, user, lang]);
  const requirementMapItems = requirementMap.items;

  // The selected buyer requirement (only when a requirement is the selected
  // type). Taken from the map items, so it has translated labels and is_mine.
  const selectedRequirement = useMemo(
    () =>
      selected && selected.type === "requirement"
        ? requirementMapItems.find((row) => row.id === selected.id) || null
        : null,
    [requirementMapItems, selected]
  );

  // What the map should highlight: exactly one of these is ever non-null
  const focusedListingId =
    selected && selected.type === "listing" ? selected.id : null;
  const focusedRequirementId =
    selected && selected.type === "requirement" ? selected.id : null;

  // Labels for the blue marker popup, translated
  const requirementLabels = useMemo(
    () => ({
      title: T("buyer.map.demand", "Buyer demand"),
      product: T("buyer.map.productNeeded", "Product needed"),
      quantity: T("buyer.form.quantity", "Quantity"),
      unit: T("buyer.form.unit", "Unit"),
      maxPrice: T("buyer.list.maxPrice", "Maximum price"),
      requiredDate: T("buyer.list.requiredDate", "Required date"),
      location: T("list.location", "Location"),
      yours: T("buyer.map.yourRequirement", "Your requirement"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  );

  // Labels for the green marker popup, translated
  const farmerLabels = useMemo(
    () => ({
      title: T("buyer.map.supply", "Farmer supply"),
      farmer: T("buyer.listing.farmer", "Farmer"),
      farmerUnknown: T("buyer.listing.farmerUnknown", "Name not available"),
      product: T("buyer.form.product", "Product"),
      quantity: T("buyer.form.quantity", "Quantity"),
      unit: T("buyer.form.unit", "Unit"),
      price: T("list.price", "Expected price"),
      available: T("list.available", "Available"),
      location: T("list.location", "Location"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  );

  const myActiveCount = myRequirements.filter((row) => row.status === "active").length;
  const unmappedCount = farmerMap.unmapped + requirementMap.unmapped;

  // --- Match Engine Data --------------------------------------------------
  // Normalized farmer listings for supply matching
  const normalizedListings = useMemo(() => {
    return listings.map((listing) =>
      normalizeListing(listing, {
        coords: resolveCoords(listing),
        name: farmerNames[listing.farmer_id] || "",
      })
    );
  }, [listings, farmerNames]);

  // Supply matches computed for each of the buyer's own requirements
  const myRequirementMatches = useMemo(() => {
    const matches = new Map();
    myRequirements.forEach((req) => {
      const normReq = normalizeRequirement(req, {
        coords: resolveCoords(req),
        name: buyerName || "",
      });
      const result = findSupplyMatches(normReq, normalizedListings);
      matches.set(req.id, result);
    });
    return matches;
  }, [myRequirements, normalizedListings, buyerName]);

  // --- Selection ----------------------------------------------------------
  // Used by search results AND by the map's green marker click
  const selectListingById = useCallback((listingId) => {
    setSelected({ type: "listing", id: listingId });
    setContactError("");
  }, []);

  // Used by the map's blue marker click
  const selectRequirementById = useCallback((requirementId) => {
    setSelected({ type: "requirement", id: requirementId });
    setContactError("");
  }, []);

  // --- Actions ------------------------------------------------------------
  const goTo = (id) => {
    setActiveNav(id);
  };

  const applySearch = (product, location) => {
    setFilters({ product: product, location: location });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    applySearch(qProduct, qLocation);
  };

  const handleClearSearch = () => {
    setQProduct("");
    setQLocation("");
    applySearch("", "");
  };

  const handleHomeSearch = (event) => {
    event.preventDefault();
    applySearch(qProduct, qLocation);
    goTo("search");
  };

  // Clicking a search result selects that listing (details + map focus)
  const selectListing = (listing) => {
    selectListingById(listing.id);
  };

  // Contact Farmer: the database finds the farmer from the listing id and
  // returns the ONE private conversation for this buyer + farmer (creating it
  // the first time). Then the Messages page opens on that conversation.
  const handleContactFarmer = async (listing) => {
    if (contactBusy) {
      return;
    }
    setContactBusy(listing.id);
    setContactError("");
    try {
      const conversationId = await startConversation({ listingId: listing.id });
      if (!mountedRef.current) {
        return;
      }
      setOpenConversationId(conversationId);
      goTo("messages");
    } catch (error) {
      console.error("Could not start the conversation:", error);
      if (mountedRef.current) {
        setContactError(
          isMessagingNotSetUp(error)
            ? T(
                "chat.notSetUp",
                "Messaging is not set up yet. The messaging database setup has not been run."
              )
            : T("chat.contactFailed", "Could not open the chat: {detail}", {
                detail: errorText(error),
              })
        );
      }
    } finally {
      if (mountedRef.current) {
        setContactBusy(null);
      }
    }
  };

  // "I Need This": open the form, pre-filled from the selected listing (or the
  // search text) when the form is still empty.
  const handleNeedThis = () => {
    setFormMessage(null);
    setForm((current) => {
      if (current.product.trim()) {
        return current;
      }
      if (selectedListing) {
        return {
          ...current,
          product: selectedListing.product_name || "",
          unit: UNIT_VALUES.includes(selectedListing.unit) ? selectedListing.unit : current.unit,
          location: LOCATION_VALUES.includes(selectedListing.location)
            ? selectedListing.location
            : current.location,
        };
      }
      return {
        ...current,
        product: qProduct.trim(),
        location: qLocation || current.location,
      };
    });
    goTo("create");
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (!form.product.trim()) {
      return T("buyer.msg.enterProduct", "Enter the product name.");
    }
    if (!(Number(form.quantity) > 0)) {
      return T("buyer.msg.enterQuantity", "Enter a quantity greater than 0.");
    }
    if (!form.unit) {
      return T("buyer.msg.selectUnit", "Select a unit.");
    }
    if (!(Number(form.maxPrice) > 0)) {
      return T("buyer.msg.enterPrice", "Enter a maximum price greater than 0.");
    }
    if (!form.requiredDate) {
      return T("buyer.msg.selectDate", "Select the required date.");
    }
    if (!form.location) {
      return T("buyer.msg.selectLocation", "Select a location.");
    }
    return null;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    setFormMessage(null);

    const problem = validateForm();
    if (problem) {
      setFormMessage({ type: "error", text: problem });
      return;
    }
    if (!user) {
      setFormMessage({
        type: "error",
        text: T("msg.notLoggedIn", "You are not logged in. Please log in again."),
      });
      return;
    }

    setSaving(true);
    try {
      // Real coordinates from regions.js only. Unknown location -> null.
      const coords = findCoordinates(form.location);
      const { data: saved, error } = await supabase
        .from("buyer_requirements")
        .insert({
          buyer_id: user.id,
          product_name: form.product.trim(),
          quantity: Number(form.quantity),
          unit: form.unit,
          max_price: Number(form.maxPrice),
          required_date: form.requiredDate,
          location: form.location,
          latitude: coords ? coords.latitude : null,
          longitude: coords ? coords.longitude : null,
          status: "active",
        })
        .select(REQ_COLUMNS)
        .single();
      if (error) {
        throw error;
      }

      // Update the map state immediately with the row Supabase returned, so
      // the blue marker appears without a page refresh.
      if (saved && mountedRef.current) {
        setMyRequirements((current) => upsertRow(current, saved));
        setMapRequirements((current) => upsertRow(current, saved));
      }

      setForm(EMPTY_FORM);

      const onMap = Boolean(resolveCoords(saved));
      let text = T("buyer.msg.saved", "Requirement saved successfully.");
      if (!onMap) {
        text +=
          " " +
          T(
            "buyer.msg.noMapCoords",
            "This location has no map coordinates, so the requirement cannot be shown on the map."
          );
      }
      setFormMessage({ type: "success", text: text, showMapLink: onMap });

      // Background refresh so the lists match the database exactly
      loadRequirements(user.id);
    } catch (error) {
      console.error("Could not save the requirement:", error);
      setFormMessage({
        type: "error",
        text: T("buyer.msg.saveFailed", "Could not save the requirement: {detail}", {
          detail: errorText(error),
        }),
      });
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  const handleDelete = async (requirement) => {
    if (deletingId || !user) {
      return;
    }
    const confirmed = window.confirm(
      T("buyer.msg.deleteConfirm", 'Delete the requirement for "{name}"?\n\nThis cannot be undone.', {
        name: requirement.product_name,
      })
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(requirement.id);
    setListMessage(null);
    try {
      const { data, error } = await supabase
        .from("buyer_requirements")
        .delete()
        .eq("id", requirement.id)
        .eq("buyer_id", user.id)
        .select("id");
      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        setListMessage({
          type: "error",
          text: T(
            "buyer.msg.deleteNothing",
            "Nothing was deleted. The requirement may no longer exist, or you do not have permission to delete it."
          ),
        });
      } else {
        // Remove from both lists right away so the blue marker disappears too
        setMyRequirements((current) => current.filter((row) => row.id !== requirement.id));
        setMapRequirements((current) => current.filter((row) => row.id !== requirement.id));
        // If the deleted requirement was the selected one, clear the selection
        setSelected((current) =>
          current && current.type === "requirement" && current.id === requirement.id
            ? null
            : current
        );
        setListMessage({
          type: "success",
          text: T("buyer.msg.deleted", "Requirement deleted successfully."),
        });
        await loadRequirements(user.id);
      }
    } catch (error) {
      console.error("Could not delete the requirement:", error);
      setListMessage({
        type: "error",
        text: T("buyer.msg.deleteFailed", "Could not delete the requirement: {detail}", {
          detail: errorText(error),
        }),
      });
    } finally {
      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      // App.jsx listens to the session and returns to the login page.
    } catch (error) {
      console.error("Could not log out:", error);
      setLogoutError(
        T("msg.logoutFailed", "Could not log out: {detail}", { detail: errorText(error) })
      );
      setLoggingOut(false);
    }
  };

  // --- Small render helpers ----------------------------------------------
  const renderRow = (label, value) => (
    <div className="ks-bd-r" key={label}>
      <span className="ks-bd-r-label">{label}</span>
      <span className="ks-bd-r-value">
        {hasValue(value) ? value : T("common.notSet", "Not set")}
      </span>
    </div>
  );

  const renderMessage = (message) =>
    message ? (
      <p
        className={
          "ks-bd-msg " + (message.type === "error" ? "ks-bd-msg-error" : "ks-bd-msg-success")
        }
        role={message.type === "error" ? "alert" : "status"}
      >
        {message.text}
      </p>
    ) : null;

  const renderFormMessage = (message) => {
    if (!message) {
      return null;
    }
    return (
      <>
        {renderMessage(message)}
        {message.showMapLink && (
          <div className="ks-bd-detail-actions" style={{ marginTop: 0, marginBottom: 12 }}>
            <button type="button" className="ks-bd-btn ks-bd-btn-ghost" onClick={() => goTo("home")}>
              {T("buyer.msg.viewOnMap", "View on map")}
            </button>
          </div>
        )}
      </>
    );
  };

  const locationOptions = (
    <>
      {LOCATION_VALUES.map((value) => (
        <option key={value} value={value}>
          {locationLabel(value)}
        </option>
      ))}
    </>
  );

  const renderLegend = () => (
    <div className="ks-bd-legend">
      <span>
        <span className="ks-bd-dot" style={{ background: "#2e9e4f" }} />
        {T("buyer.map.supply", "Farmer supply")} ({farmerMapItems.length})
      </span>
      <span>
        <span className="ks-bd-dot" style={{ background: "#1f6feb" }} />
        {T("buyer.map.demand", "Buyer demand")} ({requirementMapItems.length})
      </span>
    </div>
  );

  // The marketplace map: always shows ALL active farmer listings (green) and
  // ALL active buyer requirements (blue). Search never changes it. Clicking a
  // marker selects it (green -> listing, blue -> requirement).
  const renderMapPanel = () => (
    <>
      <div className="ks-bd-map-head">
        <h2>{T("buyer.map.title", "Market map")}</h2>
        <button
          type="button"
          className="ks-bd-btn ks-bd-btn-ghost ks-bd-btn-small"
          onClick={refreshMarketplace}
          disabled={listingsLoading || reqLoading}
        >
          <Icon name="refresh" size={16} />
          {T("buyer.map.refresh", "Refresh map")}
        </button>
      </div>

      {renderLegend()}

      {listingsError && (
        <p className="ks-bd-msg ks-bd-msg-error" role="alert">
          {T("buyer.search.loadFailed", "Could not load farmer listings: {detail}", {
            detail: listingsError,
          })}
        </p>
      )}
      {reqError && (
        <p className="ks-bd-msg ks-bd-msg-error" role="alert">
          {T("buyer.msg.loadFailed", "Could not load requirements: {detail}", {
            detail: reqError,
          })}
        </p>
      )}

      <div className="ks-bd-map">
        <GoogleMarketMap
          lang={lang}
          onRegionSelect={() => {}}
          selectedRegionId={null}
          farmerListings={farmerMapItems}
          farmerLabels={farmerLabels}
          buyerRequirements={requirementMapItems}
          requirementLabels={requirementLabels}
          noVerifiedOpportunitiesText={T("map.noVerifiedOpportunities", "No verified mandi opportunities are currently available.")}
          focusedListingId={focusedListingId}
          focusedRequirementId={focusedRequirementId}
          onListingSelect={selectListingById}
          onRequirementSelect={selectRequirementById}
        />
      </div>

      {unmappedCount > 0 && (
        <p className="ks-bd-note">
          {T(
            "buyer.map.unmapped",
            "{count} item(s) cannot be shown on the map because their location has no coordinates.",
            { count: unmappedCount }
          )}
        </p>
      )}
      <p className="ks-bd-note">
        {T(
          "buyer.map.hint2",
          "Green markers are farmer listings and blue markers are buyer requirements. Click a marker to see its details."
        )}
      </p>
    </>
  );

  // --- Details panels -----------------------------------------------------
  // GREEN: selected farmer listing (Contact Farmer + I Need This)
  const renderListingDetails = (listing) => (
    <div className="ks-bd-panel ks-bd-detail" aria-live="polite">
      <h2>{T("buyer.listing.details", "Farmer details")}</h2>
      {listing.photo_url && (
        <img
          className="ks-bd-photo"
          src={listing.photo_url}
          alt={productLabel(listing.product_name)}
        />
      )}
      <div className="ks-bd-rows">
        {renderRow(T("buyer.listing.farmer", "Farmer"), farmerName(listing))}
        {renderRow(T("buyer.form.product", "Product"), productLabel(listing.product_name))}
        {renderRow(T("buyer.form.quantity", "Quantity"), listing.quantity)}
        {renderRow(T("buyer.form.unit", "Unit"), unitLabel(listing.unit))}
        {renderRow(
          T("list.price", "Expected price"),
          hasValue(listing.expected_price)
            ? priceText(listing.expected_price, listing.unit)
            : null
        )}
        {renderRow(
          T("list.available", "Available"),
          formatDate(listing.available_date, dateLocale, "")
        )}
        {renderRow(T("list.location", "Location"), locationLabel(listing.location))}
      </div>
      {!resolveCoords(listing) && (
        <p className="ks-bd-note">
          {T("buyer.listing.noMapLocation", "This listing has no map location.")}
        </p>
      )}
      <div className="ks-bd-detail-actions">
        <button
          type="button"
          className="ks-bd-btn"
          onClick={() => handleContactFarmer(listing)}
          disabled={contactBusy !== null}
        >
          {contactBusy === listing.id
            ? T("chat.opening", "Opening chat...")
            : T("buyer.contact.button", "Contact Farmer")}
        </button>
        <button type="button" className="ks-bd-btn ks-bd-btn-blue" onClick={handleNeedThis}>
          {T("buyer.needThis", "I Need This")}
        </button>
      </div>
      {contactError && (
        <p className="ks-bd-msg ks-bd-msg-error" role="alert" style={{ marginTop: 10 }}>
          {contactError}
        </p>
      )}
    </div>
  );

  // BLUE: selected buyer requirement. Buyers contact farmers, not other
  // buyers, so there is no contact button here.
  const renderRequirementDetails = (requirement) => (
    <div className="ks-bd-panel ks-bd-detail ks-bd-detail-blue" aria-live="polite">
      <div className="ks-bd-detail-head">
        <h2>{T("buyer.req.details", "Buyer requirement")}</h2>
        {requirement.is_mine && (
          <span className="ks-bd-badge ks-bd-badge-blue">
            {T("buyer.map.yourRequirement", "Your requirement")}
          </span>
        )}
      </div>
      <div className="ks-bd-rows">
        {renderRow(
          T("buyer.map.productNeeded", "Product needed"),
          productLabel(requirement.product_name)
        )}
        {renderRow(T("buyer.form.quantity", "Quantity"), requirement.quantity)}
        {renderRow(T("buyer.form.unit", "Unit"), unitLabel(requirement.unit))}
        {hasValue(requirement.max_price) &&
          renderRow(
            T("buyer.list.maxPrice", "Maximum price"),
            priceText(requirement.max_price, requirement.unit)
          )}
        {hasValue(requirement.required_date) &&
          renderRow(
            T("buyer.list.requiredDate", "Required date"),
            formatDate(requirement.required_date, dateLocale, "")
          )}
        {renderRow(T("list.location", "Location"), locationLabel(requirement.location))}
      </div>
    </div>
  );

  // The details panel always represents the marker currently selected
  const renderSelectedDetails = () => {
    if (selectedListing) {
      return renderListingDetails(selectedListing);
    }
    if (selectedRequirement) {
      return renderRequirementDetails(selectedRequirement);
    }
    return null;
  };

  // --- Sections -----------------------------------------------------------
  const renderHome = () => (
    <>
      <section className="ks-bd-welcome">
        <h1>
          {T("buyer.home.welcome", "Welcome, {name}", {
            name: buyerName || T("buyer.header.buyer", "Buyer"),
          })}
        </h1>
        <p>{T("buyer.home.intro", "Post the produce you need and connect directly with farmers.")}</p>
      </section>

      <form className="ks-bd-panel" onSubmit={handleHomeSearch}>
        <div className="ks-bd-searchbar">
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-home-product">
              {T("buyer.search.product", "Product / crop")}
            </label>
            <input
              id="ks-bd-home-product"
              className="ks-bd-input"
              type="text"
              value={qProduct}
              placeholder={T("buyer.search.productPlaceholder", "e.g. Tomato")}
              onChange={(event) => setQProduct(event.target.value)}
            />
          </div>
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-home-location">
              {T("buyer.form.location", "Location")}
            </label>
            <select
              id="ks-bd-home-location"
              className="ks-bd-input"
              value={qLocation}
              onChange={(event) => setQLocation(event.target.value)}
            >
              <option value="">{T("buyer.search.allLocations", "All locations")}</option>
              {locationOptions}
            </select>
          </div>
          <button type="submit" className="ks-bd-btn">
            <Icon name="search" size={18} />
            {T("buyer.search.button", "Search farmers")}
          </button>
        </div>
      </form>

      {/* The map is visible right away: no search needed */}
      <section style={{ marginBottom: 18 }}>
        {renderMapPanel()}
        {renderSelectedDetails()}
      </section>

      <section className="ks-bd-hero" aria-label={T("buyer.home.activity", "Your Activity")}>
        <div className="ks-bd-hero-label">{T("buyer.home.activity", "Your Activity")}</div>
        <div className="ks-bd-hero-stats">
          <div>
            <div className="ks-bd-hero-value">{myActiveCount}</div>
            <div className="ks-bd-hero-caption">
              {T("buyer.home.active", "Active")} · {T("buyer.home.requirements", "Requirements")}
            </div>
          </div>
          <div>
            <div className="ks-bd-hero-value">{listings.length}</div>
            <div className="ks-bd-hero-caption">
              {T("buyer.home.farmers", "Farmer listings available")}
            </div>
          </div>
        </div>
      </section>

      <section className="ks-bd-grid">
        <button type="button" className="ks-bd-card" onClick={() => goTo("search")}>
          <span className="ks-bd-card-icon">
            <Icon name="search" size={22} />
          </span>
          <span style={{ flex: 1 }}>
            <span className="ks-bd-card-title">{T("buyer.nav.search", "Find Farmers")}</span>
            <span className="ks-bd-card-desc">
              {T("buyer.card.search.desc", "Search farmers and see them on the map")}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="ks-bd-card" onClick={() => goTo("create")}>
          <span className="ks-bd-card-icon">
            <Icon name="plus" size={22} />
          </span>
          <span style={{ flex: 1 }}>
            <span className="ks-bd-card-title">{T("buyer.nav.create", "Create Requirement")}</span>
            <span className="ks-bd-card-desc">
              {T("buyer.card.create.desc", "Post the produce you need")}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="ks-bd-card" onClick={() => goTo("requirements")}>
          <span className="ks-bd-card-icon">
            <Icon name="list" size={22} />
          </span>
          <span style={{ flex: 1 }}>
            <span className="ks-bd-card-title">
              {T("buyer.nav.requirements", "My Requirements")}
            </span>
            <span className="ks-bd-card-desc">
              {T("buyer.card.requirements.desc", "View the requirements you posted")}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button type="button" className="ks-bd-card" onClick={() => goTo("messages")}>
          <span className="ks-bd-card-icon">
            <Icon name="chat" size={22} />
          </span>
          <span style={{ flex: 1 }}>
            <span className="ks-bd-card-title">{T("buyer.nav.messages", "Messages")}</span>
            <span className="ks-bd-card-desc">
              {T("buyer.card.messages.desc", "Chat privately with farmers")}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      </section>
    </>
  );

  const renderSearch = () => (
    <>
      <div className="ks-bd-head">
        <h1>{T("buyer.search.title", "Find Farmers")}</h1>
        <p>
          {T(
            "buyer.search.subtitle",
            "Search real farmer listings by product and location, or look at the map."
          )}
        </p>
      </div>

      <div className="ks-bd-split">
        <div>
          <form className="ks-bd-panel" onSubmit={handleSearchSubmit}>
            <div className="ks-bd-field">
              <label className="ks-bd-label" htmlFor="ks-bd-product">
                {T("buyer.search.product", "Product / crop")}
              </label>
              <input
                id="ks-bd-product"
                className="ks-bd-input"
                type="text"
                value={qProduct}
                placeholder={T("buyer.search.productPlaceholder", "e.g. Tomato")}
                onChange={(event) => setQProduct(event.target.value)}
              />
            </div>
            <div className="ks-bd-field">
              <label className="ks-bd-label" htmlFor="ks-bd-location">
                {T("buyer.form.location", "Location")}
              </label>
              <select
                id="ks-bd-location"
                className="ks-bd-input"
                value={qLocation}
                onChange={(event) => setQLocation(event.target.value)}
              >
                <option value="">{T("buyer.search.allLocations", "All locations")}</option>
                {locationOptions}
              </select>
            </div>
            <div className="ks-bd-detail-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="ks-bd-btn">
                <Icon name="search" size={18} />
                {T("buyer.search.button", "Search farmers")}
              </button>
              <button type="button" className="ks-bd-btn ks-bd-btn-ghost" onClick={handleClearSearch}>
                {T("buyer.search.clear", "Clear")}
              </button>
              <button type="button" className="ks-bd-btn ks-bd-btn-blue" onClick={handleNeedThis}>
                {T("buyer.needThis", "I Need This")}
              </button>
            </div>
          </form>

          {renderSelectedDetails()}

          <h2 className="ks-bd-results-title">
            {T("buyer.search.results", "Search results ({count})", {
              count: filteredListings.length,
            })}
          </h2>

          {listingsLoading && (
            <p className="ks-bd-msg ks-bd-msg-info">
              {T("buyer.search.loading", "Loading farmer listings...")}
            </p>
          )}
          {listingsError && (
            <p className="ks-bd-msg ks-bd-msg-error" role="alert">
              {T("buyer.search.loadFailed", "Could not load farmer listings: {detail}", {
                detail: listingsError,
              })}{" "}
              <button type="button" className="ks-bd-btn ks-bd-btn-ghost" onClick={loadListings}>
                {T("buyer.retry", "Try again")}
              </button>
            </p>
          )}
          {!listingsLoading && !listingsError && filteredListings.length === 0 && (
            <p className="ks-bd-msg ks-bd-msg-info">
              {listings.length === 0
                ? T("buyer.search.noListings", "No active farmer listings yet.")
                : T("buyer.search.noMatch", "No farmers match your search.")}
            </p>
          )}

          <div className="ks-bd-list">
            {filteredListings.map((listing) => (
              <button
                type="button"
                key={listing.id}
                className="ks-bd-item"
                aria-pressed={focusedListingId === listing.id}
                onClick={() => selectListing(listing)}
              >
                <div className="ks-bd-item-top">
                  <span className="ks-bd-item-title">{productLabel(listing.product_name)}</span>
                  <span className="ks-bd-badge">{farmerName(listing)}</span>
                </div>
                <div className="ks-bd-rows">
                  {renderRow(
                    T("buyer.form.quantity", "Quantity"),
                    hasValue(listing.quantity)
                      ? listing.quantity + " " + unitLabel(listing.unit)
                      : null
                  )}
                  {renderRow(
                    T("list.price", "Expected price"),
                    hasValue(listing.expected_price)
                      ? priceText(listing.expected_price, listing.unit)
                      : null
                  )}
                  {renderRow(T("list.location", "Location"), locationLabel(listing.location))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>{renderMapPanel()}</div>
      </div>
    </>
  );

  const renderCreate = () => (
    <>
      <div className="ks-bd-head">
        <h1>{T("buyer.create.title", "Create a Requirement")}</h1>
        <p>{T("buyer.create.subtitle", "Tell farmers what produce you need.")}</p>
      </div>

      <form className="ks-bd-panel" onSubmit={handleSave} noValidate style={{ maxWidth: 640 }}>
        {renderFormMessage(formMessage)}

        <div className="ks-bd-field">
          <label className="ks-bd-label" htmlFor="ks-bd-f-product">
            {T("buyer.form.product", "Product")}
          </label>
          <input
            id="ks-bd-f-product"
            className="ks-bd-input"
            type="text"
            value={form.product}
            disabled={saving}
            placeholder={T("buyer.form.productPlaceholder", "Enter product name")}
            onChange={(event) => updateForm("product", event.target.value)}
          />
        </div>

        <div className="ks-bd-row2">
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-f-quantity">
              {T("buyer.form.quantity", "Quantity")}
            </label>
            <input
              id="ks-bd-f-quantity"
              className="ks-bd-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.quantity}
              disabled={saving}
              placeholder={T("buyer.form.quantityPlaceholder", "e.g. 500")}
              onChange={(event) => updateForm("quantity", event.target.value)}
            />
          </div>
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-f-unit">
              {T("buyer.form.unit", "Unit")}
            </label>
            <select
              id="ks-bd-f-unit"
              className="ks-bd-input"
              value={form.unit}
              disabled={saving}
              onChange={(event) => updateForm("unit", event.target.value)}
            >
              <option value="">{T("buyer.form.selectUnit", "Select unit")}</option>
              {UNIT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {T("unit." + value, value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ks-bd-row2">
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-f-price">
              {T("buyer.form.maxPrice", "Maximum Price")}
            </label>
            <input
              id="ks-bd-f-price"
              className="ks-bd-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.maxPrice}
              disabled={saving}
              placeholder={T("buyer.form.maxPricePlaceholder", "e.g. 32")}
              onChange={(event) => updateForm("maxPrice", event.target.value)}
            />
          </div>
          <div className="ks-bd-field">
            <label className="ks-bd-label" htmlFor="ks-bd-f-date">
              {T("buyer.form.requiredDate", "Required Date")}
            </label>
            <input
              id="ks-bd-f-date"
              className="ks-bd-input"
              type="date"
              value={form.requiredDate}
              disabled={saving}
              onChange={(event) => updateForm("requiredDate", event.target.value)}
            />
          </div>
        </div>

        <div className="ks-bd-field">
          <label className="ks-bd-label" htmlFor="ks-bd-f-location">
            {T("buyer.form.location", "Location")}
          </label>
          <select
            id="ks-bd-f-location"
            className="ks-bd-input"
            value={form.location}
            disabled={saving}
            onChange={(event) => updateForm("location", event.target.value)}
          >
            <option value="">{T("buyer.form.selectLocation", "Select location")}</option>
            {locationOptions}
          </select>
        </div>

        <button type="submit" className="ks-bd-btn ks-bd-btn-blue" disabled={saving}>
          {saving
            ? T("buyer.form.saving", "Saving requirement...")
            : T("buyer.form.save", "Save Requirement")}
        </button>
      </form>
    </>
  );

  const renderRequirements = () => (
    <>
      <div className="ks-bd-head">
        <h1>{T("buyer.list.title", "My Requirements")}</h1>
        <p>{T("buyer.list.subtitle", "The produce requirements you have posted.")}</p>
      </div>

      {renderMessage(listMessage)}

      {reqLoading && (
        <p className="ks-bd-msg ks-bd-msg-info">
          {T("buyer.list.loading", "Loading requirements...")}
        </p>
      )}
      {reqError && (
        <p className="ks-bd-msg ks-bd-msg-error" role="alert">
          {T("buyer.msg.loadFailed", "Could not load requirements: {detail}", {
            detail: reqError,
          })}{" "}
          <button
            type="button"
            className="ks-bd-btn ks-bd-btn-ghost"
            onClick={() => user && loadRequirements(user.id)}
          >
            {T("buyer.retry", "Try again")}
          </button>
        </p>
      )}
      {!reqLoading && !reqError && myRequirements.length === 0 && (
        <p className="ks-bd-msg ks-bd-msg-info">
          {T("buyer.list.empty", "No requirements yet. Create your first requirement.")}
        </p>
      )}

      <div className="ks-bd-list" style={{ maxWidth: 720 }}>
        {myRequirements.map((requirement) => {
          const matchResult = myRequirementMatches.get(requirement.id);
          const best = matchResult ? matchResult.best : null;
          const status = matchResult ? matchResult.status : "none";
          const explanationLines = matchResult
            ? getMatchExplanation(matchResult, lang, productLabel, unitLabel)
            : [];

          let statusBadgeClass = "ks-bd-badge-none";
          let statusText = "No Match";
          if (status === "complete") {
            statusBadgeClass = "ks-bd-badge-complete";
            statusText = "Complete Match";
          } else if (status === "partial") {
            statusBadgeClass = "ks-bd-badge-partial";
            statusText = "Partial Match";
          }

          return (
            <div key={requirement.id} className="ks-bd-item ks-bd-item-static">
              <div className="ks-bd-item-top">
                <span className="ks-bd-item-title">{productLabel(requirement.product_name)}</span>
                <span className="ks-bd-badge ks-bd-badge-blue">
                  {requirement.status === "active"
                    ? T("status.active", "Active")
                    : requirement.status}
                </span>
              </div>
              <div className="ks-bd-rows">
                {renderRow(
                  T("buyer.form.quantity", "Quantity"),
                  hasValue(requirement.quantity)
                    ? requirement.quantity + " " + unitLabel(requirement.unit)
                    : null
                )}
                {renderRow(
                  T("buyer.list.maxPrice", "Maximum price"),
                  hasValue(requirement.max_price)
                    ? priceText(requirement.max_price, requirement.unit)
                    : null
                )}
                {renderRow(
                  T("buyer.list.requiredDate", "Required date"),
                  formatDate(requirement.required_date, dateLocale, "")
                )}
                {renderRow(T("list.location", "Location"), locationLabel(requirement.location))}
                {!resolveCoords(requirement) &&
                  renderRow(
                    T("buyer.list.onMap", "On map"),
                    T("buyer.list.notOnMap", "No (location has no coordinates)")
                  )}
              </div>

              {/* Match Engine Results Section */}
              <BuyerMatchCard
                matchResult={matchResult}
                requirement={requirement}
                lang={lang}
                productLabel={productLabel}
                unitLabel={unitLabel}
                locationLabel={locationLabel}
                priceText={priceText}
                T={T}
                handleContactFarmer={handleContactFarmer}
                contactBusy={contactBusy}
                contactError={contactError}
              />

              <div className="ks-bd-detail-actions">
                <button
                  type="button"
                  className="ks-bd-btn ks-bd-btn-danger"
                  disabled={deletingId === requirement.id}
                  onClick={() => handleDelete(requirement)}
                >
                  {deletingId === requirement.id
                    ? T("list.deleting", "Deleting...")
                    : T("list.delete", "Delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // Private conversations with farmers
  const renderMessages = () => (
    <MessagesCenter
      user={user}
      lang={lang}
      initialConversationId={openConversationId}
      accent="#16a34a"
    />
  );

  let content;
  if (activeNav === "search") {
    content = renderSearch();
  } else if (activeNav === "create") {
    content = renderCreate();
  } else if (activeNav === "requirements") {
    content = renderRequirements();
  } else if (activeNav === "messages") {
    content = renderMessages();
  } else {
    content = renderHome();
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === activeNav);

  return (
    <div className="ks-bd">
      <style>{CSS}</style>

      <aside className="ks-bd-side">
        <div className="ks-bd-brand">
          <img className="ks-brand-logo" src="/krishi-samparka-logo.jpeg" alt="" />
          <span className="ks-fd-brand-copy">
            <span className="ks-bd-brand-name">Krishi Samparka</span>
            <span className="ks-brand-local" lang="kn">ಕೃಷಿ ಸಂಪರ್ಕ</span>
          </span>
        </div>

        <nav className="ks-bd-nav" aria-label={T("buyer.nav.main", "Main")}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ks-bd-nav-item"
              aria-current={activeNav === item.id ? "page" : undefined}
              onClick={() => goTo(item.id)}
            >
              <Icon name={item.icon} size={18} />
              {T(item.key, item.fallback)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="ks-bd-main">
        <header className="ks-bd-header">
          <p className="ks-bd-header-title">
            {T("buyer.dashboard", "Buyer Dashboard")}
            {activeItem && activeNav !== "home"
              ? " / " + T(activeItem.key, activeItem.fallback)
              : ""}
          </p>

          <div className="ks-bd-header-right">
            <div className="ks-bd-lang" role="group" aria-label={T("lang.label", "Language")}>
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className="ks-bd-lang-btn"
                  aria-pressed={lang === option.code}
                  onClick={() => changeLanguage(option.code)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="ks-bd-profile">
              <span className="ks-bd-avatar">
                <Icon name="user" size={18} />
              </span>
              <span className="ks-bd-profile-text">
                <div className="ks-bd-profile-name">
                  {buyerName || T("buyer.header.buyer", "Buyer")}
                </div>
                <div className="ks-bd-profile-role">
                  {T("buyer.header.role", "Buyer account")}
                </div>
              </span>
            </div>

            <button
              type="button"
              className="ks-bd-logout"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <Icon name="logout" size={16} />
              {loggingOut
                ? T("header.loggingOut", "Logging out...")
                : T("header.logout", "Logout")}
            </button>
          </div>
        </header>

        {logoutError && (
          <p className="ks-bd-msg ks-bd-msg-error" role="alert">
            {logoutError}
          </p>
        )}

        {content}
      </main>
    </div>
  );
}

export default BuyerDashboard;
