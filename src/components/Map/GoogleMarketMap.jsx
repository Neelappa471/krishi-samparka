import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { env, isGoogleMapsConfigured } from "../../config/env";
import { REGIONS } from "../../data/regions";
import { MAP_DEMO_OPPORTUNITIES, MAP_DEMO_OPPORTUNITY_COPY } from "../../data/mapDemoOpportunities";
import { ILLUSTRATIVE_MARKET_AREAS, ILLUSTRATIVE_TRADER_ACTIVITY } from "../../data/mapIllustrativeActivity";
import { translate } from "../../i18n/translations";
import { getMandiDataFreshness } from "../../utils/marketPriceApi";
// NOTE: if your config/supabase.js uses a default export, change this to:
//   import supabase from "../../config/supabase";
import { supabase } from "../../config/supabase";

const DEFAULT_CENTER = { lat: 13.1, lng: 74.9 };
const DEFAULT_ZOOM = 8;

// AdvancedMarkerElement requires a mapId. Google provides "DEMO_MAP_ID" for
// development and prototyping. For production, set VITE_GOOGLE_MAPS_MAP_ID.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

// The dataset does not state a currency. Change or empty this if needed.
const CURRENCY_SYMBOL = "₹";

// Stable defaults, so omitted props do not look "changed" on every render
const EMPTY_LIST = [];
const EMPTY_OBJECT = {};

// Real mandi opportunities can reach the map either as the `opportunities`
// prop or through this context (the dashboard wraps the marketplace with it, so
// FarmerMarketplace does not have to forward them). Default: no opportunities.
export const MandiOpportunityContext = createContext({
  opportunities: EMPTY_LIST,
  labels: EMPTY_OBJECT,
});

// ---------------------------------------------------------------------------
// Marker layout
//
// Farmer listings and buyer requirements (real data from Supabase) keep their
// REAL latitude / longitude: marker.position is never changed. When several of
// them (or a red region marker) sit on exactly the same coordinates, only the
// way each marker is DRAWN is shifted by a few screen pixels, in a small ring
// around the real point, in a stable order. Both stay visible and clickable,
// and nothing is written back to the database.
// ---------------------------------------------------------------------------
const MARKET_SIZE = 16;
const LISTING_SIZE = 20;
const REQUIREMENT_SIZE = 20;

// z-index values (selected markers are raised above everything)
const LISTING_Z = 4;
const REQUIREMENT_Z = 5;
const SELECTED_Z = 10;

// Visual spreading of markers that share the same coordinates (screen pixels)
const SPREAD_START_RADIUS = 26;
const SPREAD_RING_STEP = 24;
const SPREAD_FIRST_RING_CAPACITY = 6;

const COLORS = {
  supply: "#2e9e4f",
  demand: "#1f6feb",
  opportunity: "#8e44ad",
  trader: "#e67e22",
  market: "#d64545",
};

const containerStyle = {
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: "400px",
};

const mapStyle = {
  width: "100%",
  height: "100%",
  minHeight: "400px",
};

const overlayStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  textAlign: "center",
  background: "rgba(255, 255, 255, 0.85)",
  color: "#333333",
  fontSize: "14px",
  zIndex: 1,
};

const legendStyle = {
  position: "absolute",
  left: "10px",
  bottom: "24px",
  padding: "8px 12px",
  background: "#ffffff",
  color: "#222222",
  border: "1px solid #dddddd",
  borderRadius: "6px",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
  fontSize: "13px",
  zIndex: 1,
};

const opportunityStatusStyle = {
  position: "absolute",
  top: "10px",
  right: "10px",
  maxWidth: "300px",
  padding: "8px 10px",
  background: "#ffffff",
  color: "#444444",
  border: "1px solid #dddddd",
  borderRadius: "6px",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
  fontSize: "12px",
  lineHeight: "1.4",
  zIndex: 1,
};

const legendRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  lineHeight: "22px",
};

// Small status box (top-left) for the farmer listing layer (self-fetch mode)
const listingStatusStyle = {
  position: "absolute",
  top: "10px",
  left: "10px",
  maxWidth: "280px",
  padding: "6px 10px",
  background: "#ffffff",
  color: "#333333",
  border: "1px solid #dddddd",
  borderRadius: "6px",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
  fontSize: "12px",
  lineHeight: "1.4",
  zIndex: 1,
};

function legendDotStyle(color, square) {
  return {
    width: "12px",
    height: "12px",
    borderRadius: square ? "3px" : "50%",
    background: color,
    border: "2px solid #ffffff",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.25)",
    boxSizing: "border-box",
    flexShrink: 0,
  };
}

const LEGEND_ITEMS = [
  { key: "map.legend.supply", color: COLORS.supply, square: true },
  { key: "map.legend.demand", color: COLORS.demand },
  { key: "map.legend.trader", color: COLORS.trader },
  { key: "map.legend.market", color: COLORS.market },
];

let optionsConfigured = false;

function configureLoader(apiKey) {
  if (optionsConfigured) {
    return;
  }
  setOptions({
    key: apiKey,
    v: "weekly",
  });
  optionsConfigured = true;
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function displayValue(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }
  return String(value);
}

function hasValidCoordinates(region) {
  return (
    region &&
    !Number.isNaN(Number(region.latitude)) &&
    !Number.isNaN(Number(region.longitude))
  );
}

function isVerifiedMapOpportunity(opportunity) {
  if (
    !opportunity ||
    opportunity.sourceType !== "live-api" ||
    opportunity.isPrototype !== false ||
    opportunity.verifiedCoordinate !== true ||
    opportunity.unitVerified !== true ||
    !opportunity.priceUnit ||
    !Number.isFinite(Number(opportunity.comparedMarketCount)) ||
    Number(opportunity.comparedMarketCount) < 3
  ) {
    return false;
  }

  const localPrice = Number(opportunity.localPrice);
  const betterPrice = Number(opportunity.betterPrice);
  const difference = Number(opportunity.priceDifference);
  const latitude = Number(opportunity.latitude);
  const longitude = Number(opportunity.longitude);
  if (
    !Number.isFinite(localPrice) ||
    !Number.isFinite(betterPrice) ||
    !Number.isFinite(difference) ||
    localPrice <= 0 ||
    betterPrice <= localPrice ||
    difference <= 0 ||
    Math.abs(betterPrice - localPrice - difference) > 0.01 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }

  return (
    getMandiDataFreshness(opportunity.localArrivalDate).category === "recent" &&
    getMandiDataFreshness(opportunity.arrivalDate).category === "recent"
  );
}

// ---------------------------------------------------------------------------
// Farmer listing helpers (real data from Supabase)
// ---------------------------------------------------------------------------

// Returns { lat, lng } only when the listing has real stored coordinates.
// null / undefined / "" / non-numbers / out-of-range values are rejected.
// (Number(null) is 0, so missing values must be rejected explicitly.)
// Also used for buyer requirements.
function getListingPosition(listing) {
  const rawLat = listing.latitude;
  const rawLng = listing.longitude;

  if (
    rawLat === null ||
    rawLat === undefined ||
    rawLat === "" ||
    rawLng === null ||
    rawLng === undefined ||
    rawLng === ""
  ) {
    return null;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat: lat, lng: lng };
}

// "2026-10-10" -> "10 Oct 2026" (parsed manually to avoid timezone shifts)
function formatListingDate(value) {
  if (!value) {
    return null;
  }
  const parts = String(value).slice(0, 10).split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) {
    return String(value);
  }
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function singularUnit(unit) {
  if (unit === "pieces") return "piece";
  if (unit === "bags") return "bag";
  if (unit === "litres") return "litre";
  return unit;
}

function capitalize(text) {
  if (!text) {
    return "";
  }
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

// Only allow http(s) image URLs inside the popup
function isSafeImageUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// ---------------------------------------------------------------------------
// Visual spreading of markers that share the same coordinates
// ---------------------------------------------------------------------------

// Key for "exactly the same place" (5 decimals is about 1 metre)
function coordKey(position) {
  return position.lat.toFixed(5) + "," + position.lng.toFixed(5);
}

// Coordinates of region reference points, used to avoid obscuring a region.
function getRegionKeySet() {
  const keys = new Set();
  (REGIONS || []).forEach((region) => {
    if (hasValidCoordinates(region)) {
      keys.add(
        coordKey({ lat: Number(region.latitude), lng: Number(region.longitude) })
      );
    }
  });
  return keys;
}

// entries: [{ id, position: {lat, lng}, order }]
// Returns Map(id -> { dx, dy }) in screen pixels.
//   * a lone marker on an empty spot is not moved
//   * markers that share a spot (or share it with a red region marker) are placed
//     on a ring around the real point, always in the same order, so the layout
//     is identical after every refresh
//   * the real position (marker.position) is never changed
function computeSpread(entries, occupiedKeys) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = coordKey(entry.position);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  });

  const offsets = new Map();
  groups.forEach((group, key) => {
    const centerTaken = Boolean(occupiedKeys && occupiedKeys.has(key));
    if (group.length === 1 && !centerTaken) {
      offsets.set(group[0].id, { dx: 0, dy: 0 });
      return;
    }

    group.sort(
      (a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id))
    );

    let index = 0;
    let ring = 1;
    while (index < group.length) {
      const capacity = SPREAD_FIRST_RING_CAPACITY * ring;
      const count = Math.min(capacity, group.length - index);
      const radius = SPREAD_START_RADIUS + (ring - 1) * SPREAD_RING_STEP;
      const startAngle = -Math.PI / 2 + (ring % 2 === 0 ? Math.PI / count : 0);
      for (let i = 0; i < count; i += 1) {
        const angle = startAngle + (2 * Math.PI * i) / count;
        offsets.set(group[index + i].id, {
          dx: Math.round(radius * Math.cos(angle)),
          dy: Math.round(radius * Math.sin(angle)),
        });
      }
      index += count;
      ring += 1;
    }
  });

  return offsets;
}

function offsetOf(spread, id) {
  return (spread && spread.get(id)) || { dx: 0, dy: 0 };
}

// ---------------------------------------------------------------------------
// InfoWindow content
// ---------------------------------------------------------------------------

function createInfoContainer(title, accentColor, subtitle) {
  const container = document.createElement("div");
  container.style.minWidth = "220px";
  container.style.maxWidth = "300px";
  container.style.color = "#222222";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.5";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "8px";
  header.style.paddingBottom = "6px";
  header.style.marginBottom = "6px";
  header.style.borderBottom = "1px solid #e5e5e5";

  const dot = document.createElement("span");
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius = "50%";
  dot.style.background = accentColor;
  dot.style.flexShrink = "0";
  header.appendChild(dot);

  const titleElement = document.createElement("strong");
  titleElement.style.fontSize = "14px";
  titleElement.textContent = title;
  header.appendChild(titleElement);

  container.appendChild(header);

  if (subtitle) {
    const subtitleElement = document.createElement("div");
    subtitleElement.style.color = "#666666";
    subtitleElement.style.marginBottom = "6px";
    subtitleElement.textContent = subtitle;
    container.appendChild(subtitleElement);
  }

  return container;
}

function addRow(container, label, value) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.gap = "12px";

  const labelElement = document.createElement("span");
  labelElement.style.color = "#666666";
  labelElement.textContent = label;
  row.appendChild(labelElement);

  const valueElement = document.createElement("span");
  valueElement.style.fontWeight = "600";
  valueElement.style.textAlign = "right";
  valueElement.textContent = displayValue(value);
  row.appendChild(valueElement);

  container.appendChild(row);
}

function addNote(container, text) {
  const note = document.createElement("div");
  note.style.marginTop = "8px";
  note.style.fontSize = "11px";
  note.style.color = "#777777";
  note.textContent = text;
  container.appendChild(note);
}

function localizedPair(pair, lang, fallback = "") {
  if (!Array.isArray(pair)) return fallback;
  return pair[lang === "kn" ? 1 : 0] || pair[0] || fallback;
}

function buildIllustrativeActivityInfo(kind, regionId, lang) {
  const isKannada = lang === "kn";
  const item = kind === "trader";
  const color = item ? COLORS.trader : COLORS.market;
  const title = isKannada
    ? item ? "ವ್ಯಾಪಾರಿ ಚಟುವಟಿಕೆ (ಮಾದರಿ)" : "ಮಾರುಕಟ್ಟೆ ಸ್ಥಳ (ಮಾದರಿ)"
    : item ? "Trader Activity (Illustrative)" : "Market Location (Illustrative)";
  const region = REGIONS.find((entry) => entry.id === regionId);
  const translatedRegions = {
    mangaluru: "ಮಂಗಳೂರು", udupi: "ಉಡುಪಿ", kundapura: "ಕುಂದಾಪುರ",
    karkala: "ಕಾರ್ಕಳ", bantwal: "ಬಂಟ್ವಾಳ", byndoor: "ಬೈಂದೂರು",
    puttur: "ಪುತ್ತೂರು", sullia: "ಸುಳ್ಯ", belthangady: "ಬೆಳ್ತಂಗಡಿ",
    moodabidri: "ಮೂಡಬಿದಿರೆ", manipal: "ಮಣಿಪಾಲ", ullal: "ಉಳ್ಳಾಲ",
  };
  const container = createInfoContainer(title, color, null);
  addRow(container, isKannada ? "ಸ್ಥಳ" : "Location", isKannada ? translatedRegions[regionId] || region?.name : region?.name || regionId);
  addNote(container, isKannada
    ? "ಮಾದರಿ ಪ್ರದರ್ಶನದ ಸ್ಥಳ ಮಾತ್ರ; ನೈಜ ವ್ಯಾಪಾರಿ ಅಥವಾ ಪರಿಶೀಲಿತ APMC ಸ್ಥಳವಲ್ಲ."
    : "Illustrative display point only; not a real trader or verified APMC location.");
  return container;
}

function buildDemoOpportunityInfoContent(opportunity, lang) {
  const copy = MAP_DEMO_OPPORTUNITY_COPY[opportunity.id] || EMPTY_OBJECT;
  const isKannada = lang === "kn";
  const container = createInfoContainer(
    localizedPair(copy.title, lang, isKannada ? "ಸಂಭಾವ್ಯ ಅವಕಾಶ (ಮಾದರಿ)" : "Potential Opportunity (Illustrative)"),
    COLORS.opportunity,
    isKannada ? "ಸಂಭಾವ್ಯ ಅವಕಾಶ (ಮಾದರಿ)" : "Potential opportunity (illustrative)"
  );
  addRow(container, isKannada ? "ಬೆಳೆ" : "Crop", localizedPair(copy.crop, lang, opportunity.cropKey));
  addRow(container, isKannada ? "ಸ್ಥಳ" : "Location", localizedPair(copy.location, lang, opportunity.locationKey));
  addRow(container, isKannada ? "ಏಕೆ ಪರಿಶೀಲಿಸಬೇಕು" : "Why explore", localizedPair(copy.reason, lang));
  addRow(container, isKannada ? "ಮುಂದಿನ ಕ್ರಮ" : "Suggested next action", localizedPair(copy.action, lang));
  addNote(container, isKannada
    ? "ಮಾದರಿ ಪ್ರದರ್ಶನದ ದತ್ತಾಂಶ — ಕಾಲ್ಪನಿಕ ಉದಾಹರಣೆ; ನೈಜ ಬೇಡಿಕೆ ಅಥವಾ ಬೆಲೆ ಅಲ್ಲ."
    : "Simulated demo data — fictional example, not actual demand or pricing.");
  return container;
}

// Purple marker: one REAL opportunity from getMandiOpportunities() (live
// Mandi Price API). Labels come from the dashboard (translated); the English
// text is only a fallback.
function formatMandiMoney(value, unit, labels) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const money = CURRENCY_SYMBOL + number.toLocaleString("en-IN");
  return unit
    ? money + " / " + unit
    : money + " (" + (labels.unitNotVerified || "Unit not verified") + ")";
}

function buildMandiOpportunityInfoContent(opportunity, labels) {
  const L = labels || EMPTY_OBJECT;
  const container = createInfoContainer(
    L.title || "Market Opportunity",
    COLORS.opportunity,
    null
  );

  addRow(container, L.crop || "Crop", opportunity.crop || opportunity.commodity);
  if (opportunity.variety) {
    addRow(container, L.variety || "Variety", opportunity.variety);
  }
  if (opportunity.grade) {
    addRow(container, L.grade || "Grade", opportunity.grade);
  }
  addRow(container, L.localMarket || "Local market", opportunity.localMarket);
  addRow(
    container,
    L.localPrice || "Local price",
    formatMandiMoney(opportunity.localPrice, opportunity.localPriceUnit, L)
  );
  addRow(container, L.betterMarket || "Better market", opportunity.betterMarket);
  addRow(
    container,
    L.betterPrice || "Better price",
    formatMandiMoney(opportunity.betterPrice, opportunity.priceUnit, L)
  );
  addRow(
    container,
    L.priceDifference || "Price difference",
    formatMandiMoney(opportunity.priceDifference, opportunity.priceUnit, L)
  );
  addRow(container, L.date || "Date", opportunity.arrivalDate);

  const meta = document.createElement("div");
  meta.style.marginTop = "8px";
  addRow(meta, L.source || "Source", opportunity.source);
  container.appendChild(meta);

  addNote(
    container,
    L.disclaimer ||
      "Potential price difference only. Transport, commission, spoilage and other costs are not included."
  );

  return container;
}

// Green square marker (self-fetch mode): one real farmer listing from Supabase.
// Used only when the parent does NOT pass the farmerListings prop.
function buildListingInfoContent(listing) {
  const container = createInfoContainer(
    listing.product_name || "Farmer listing",
    COLORS.supply,
    "Farmer Listing"
  );

  if (isSafeImageUrl(listing.photo_url)) {
    const photo = document.createElement("img");
    photo.src = listing.photo_url;
    photo.alt = listing.product_name || "Produce photo";
    photo.style.width = "100%";
    photo.style.height = "140px";
    photo.style.objectFit = "cover";
    photo.style.borderRadius = "6px";
    photo.style.marginBottom = "8px";
    photo.style.display = "block";
    photo.addEventListener("error", () => {
      photo.style.display = "none";
    });
    container.appendChild(photo);
  }

  const quantity =
    listing.quantity !== null && listing.quantity !== undefined
      ? listing.quantity + (listing.unit ? " " + listing.unit : "")
      : null;

  let price = null;
  if (listing.expected_price !== null && listing.expected_price !== undefined) {
    price =
      CURRENCY_SYMBOL +
      listing.expected_price +
      (listing.unit ? " / " + singularUnit(listing.unit) : "");
  }

  addRow(container, "Quantity", quantity);
  addRow(container, "Expected price", price);
  addRow(container, "Location", listing.location);

  const available = formatListingDate(listing.available_date);
  if (available) {
    addRow(container, "Available", available);
  }

  addRow(container, "Status", capitalize(listing.status));

  return container;
}

// Green square marker (prop mode): farmer listing passed by the dashboard,
// with farmer name and translated labels.
function buildFarmerPopupContent(listing, labels) {
  const container = createInfoContainer(
    labels.title || "Farmer supply",
    COLORS.supply,
    listing.is_mine ? labels.yours || "Your listing" : null
  );

  if (isSafeImageUrl(listing.photo_url)) {
    const photo = document.createElement("img");
    photo.src = listing.photo_url;
    photo.alt = listing.product_label || listing.product_name || "";
    photo.style.width = "100%";
    photo.style.height = "140px";
    photo.style.objectFit = "cover";
    photo.style.borderRadius = "6px";
    photo.style.marginBottom = "8px";
    photo.style.display = "block";
    photo.addEventListener("error", () => {
      photo.style.display = "none";
    });
    container.appendChild(photo);
  }

  addRow(
    container,
    labels.farmer || "Farmer",
    listing.farmer_name || labels.farmerUnknown || "Name not available"
  );
  addRow(container, labels.product || "Product", listing.product_label || listing.product_name);
  addRow(container, labels.quantity || "Quantity", listing.quantity);
  addRow(container, labels.unit || "Unit", listing.unit_label || listing.unit);
  addRow(container, labels.price || "Expected price", listing.price_text || null);
  const available = formatListingDate(listing.available_date);
  if (available) {
    addRow(container, labels.available || "Available", available);
  }
  addRow(container, labels.location || "Location", listing.location_label || listing.location);
  return container;
}

// Blue marker popup for one real buyer requirement ("I Need This").
// Shows: product needed, quantity, unit, maximum price (if available),
// required date (if available) and location.
function buildRequirementInfoContent(req, labels) {
  const container = createInfoContainer(
    labels.title || "Buyer demand",
    COLORS.demand,
    req.is_mine ? labels.yours || "Your requirement" : null
  );
  addRow(container, labels.product || "Product needed", req.product_label || req.product_name);
  addRow(container, labels.quantity || "Quantity", req.quantity);
  addRow(container, labels.unit || "Unit", req.unit_label || req.unit);
  if (req.max_price !== null && req.max_price !== undefined && req.max_price !== "") {
    addRow(
      container,
      labels.maxPrice || "Maximum price",
      req.price_text ||
        CURRENCY_SYMBOL + req.max_price + (req.unit ? " / " + singularUnit(req.unit) : "")
    );
  }
  const required = formatListingDate(req.required_date);
  if (required) {
    addRow(container, labels.requiredDate || "Required date", required);
  }
  addRow(container, labels.location || "Location", req.location_label || req.location);
  return container;
}

// ---------------------------------------------------------------------------
// Marker visuals
// ---------------------------------------------------------------------------

// Clean circular marker. AdvancedMarkerElement anchors content at its bottom
// center, so we shift the circle down by half its size to center it on the
// marker position. dx / dy (screen pixels) are the optional visual spread for
// markers that share the same coordinates; the real position is not changed.
function buildCircle(size, color, dx = 0, dy = 0) {
  const circle = document.createElement("div");
  circle.style.width = size + "px";
  circle.style.height = size + "px";
  circle.style.borderRadius = "50%";
  circle.style.background = color;
  circle.style.border = "2px solid #ffffff";
  circle.style.boxSizing = "border-box";
  circle.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.45)";
  circle.style.cursor = "pointer";
  circle.style.transform = "translate(" + dx + "px, " + (size / 2 + dy) + "px)";
  return circle;
}

// Rounded square marker for genuine farmer listings.
function buildSquare(size, color, dx = 0, dy = 0) {
  const square = document.createElement("div");
  square.style.width = size + "px";
  square.style.height = size + "px";
  square.style.borderRadius = "4px";
  square.style.background = color;
  square.style.border = "2px solid #ffffff";
  square.style.boxSizing = "border-box";
  square.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.45)";
  square.style.cursor = "pointer";
  square.style.transform = "translate(" + dx + "px, " + (size / 2 + dy) + "px)";
  return square;
}

// Larger blue circle with a blue ring for genuine buyer requirements.
function buildRequirementMarker(size, color, dx = 0, dy = 0) {
  const marker = buildCircle(size, color, dx, dy);
  marker.style.border = "3px solid #ffffff";
  marker.style.boxShadow = "0 0 0 2px " + color + ", 0 1px 4px rgba(0, 0, 0, 0.5)";
  return marker;
}

// Remember the normal look of a marker so the "selected" highlight can be
// switched on and off without rebuilding the marker.
function rememberBaseLook(content, baseZ) {
  content.dataset.baseShadow = content.style.boxShadow || "";
  content.dataset.baseZ = String(baseZ);
}

// Yellow ring + raised z-index for the currently selected marker
function setMarkerHighlight(marker, on) {
  const content = marker && marker.content;
  if (!content || !content.style) {
    return;
  }
  const base = content.dataset.baseShadow || "";
  content.style.boxShadow = on ? "0 0 0 4px #facc15, " + base : base;
  marker.zIndex = on ? SELECTED_Z : Number(content.dataset.baseZ) || 1;
}

// Props:
//   onRegionSelect, selectedRegionId   - existing red region behaviour
//   farmerListings                     - GREEN markers from the parent. When
//                                        this prop is an array, the map does
//                                        NOT fetch listings itself.
//   farmerLabels                       - translated labels for the green popup
//   buyerRequirements                  - BLUE markers from the parent
//   requirementLabels                  - translated labels for the blue popup
//   focusedListingId                   - highlight + pan to this green marker
//   focusedRequirementId               - highlight + pan to this blue marker
//   onListingSelect(id)                - called when a green marker is clicked
//   onRequirementSelect(id)            - called when a blue marker is clicked
//   opportunities                      - REAL mandi opportunities (purple markers,
//                                        only those with verifiedCoordinate)
//   opportunityLabels                  - translated labels for the purple popup
export function GoogleMarketMap({
  lang = "en",
  onRegionSelect,
  selectedRegionId,
  farmerListings,
  farmerLabels = EMPTY_OBJECT,
  buyerRequirements = EMPTY_LIST,
  requirementLabels = EMPTY_OBJECT,
  focusedListingId = null,
  focusedRequirementId = null,
  onListingSelect,
  onRequirementSelect,
  opportunities,
  opportunityLabels,
  noVerifiedOpportunitiesText = "No verified mandi opportunities are currently available.",
}) {
  const usesPropListings = Array.isArray(farmerListings);

  // REAL mandi opportunities (prop first, otherwise the context value)
  const mandiContext = useContext(MandiOpportunityContext);
  const realOpportunities = Array.isArray(opportunities)
    ? opportunities
    : mandiContext.opportunities;
  const mandiLabels = opportunityLabels || mandiContext.labels || EMPTY_OBJECT;
  const opportunitiesToCheck = Array.isArray(realOpportunities)
    ? realOpportunities
    : EMPTY_LIST;
  const verifiedOpportunities = useMemo(
    () => opportunitiesToCheck.filter(isVerifiedMapOpportunity),
    [opportunitiesToCheck]
  );

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerLibRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markersRef = useRef({});
  const listenersRef = useRef([]);
  const onRegionSelectRef = useRef(onRegionSelect);
  const onListingSelectRef = useRef(onListingSelect);
  const onRequirementSelectRef = useRef(onRequirementSelect);

  // id -> marker, for the green and blue layers (used to highlight / pan)
  const listingMarkersRef = useRef({});
  const requirementMarkersRef = useRef({});
  const lastFocusKeyRef = useRef("");

  const configured = isGoogleMapsConfigured();
  const [status, setStatus] = useState(configured ? "loading" : "missing-key");
  const [errorMessage, setErrorMessage] = useState("");

  // Farmer listing layer state (self-fetch mode only): idle | loading | ready | error
  const [listingLayer, setListingLayer] = useState({
    state: "idle",
    shown: 0,
    skipped: 0,
    message: "",
  });

  // Visual spread for green + blue markers that share the same coordinates
  // (prop mode). Computed from BOTH layers together so a listing and a
  // requirement on the same spot are separated from each other.
  const spread = useMemo(() => {
    const entries = [];
    if (Array.isArray(farmerListings)) {
      farmerListings.forEach((listing) => {
        const position = getListingPosition(listing);
        if (position) {
          entries.push({ id: "L:" + listing.id, position: position, order: 0 });
        }
      });
    }
    (buyerRequirements || EMPTY_LIST).forEach((req) => {
      const position = getListingPosition(req);
      if (position) {
        entries.push({ id: "R:" + req.id, position: position, order: 1 });
      }
    });
    return computeSpread(entries, getRegionKeySet());
  }, [farmerListings, buyerRequirements]);

  // Keep latest callbacks without re-creating markers
  useEffect(() => {
    onRegionSelectRef.current = onRegionSelect;
  }, [onRegionSelect]);

  useEffect(() => {
    onListingSelectRef.current = onListingSelect;
  }, [onListingSelect]);

  useEffect(() => {
    onRequirementSelectRef.current = onRequirementSelect;
  }, [onRequirementSelect]);

  // Load Google Maps, create map and markers
  useEffect(() => {
    if (!configured || !env.googleMapsApiKey) {
      setStatus("missing-key");
      return undefined;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");

    configureLoader(env.googleMapsApiKey);

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([mapsLib, markerLib]) => {
        if (cancelled || !mapElementRef.current) {
          return;
        }

        markerLibRef.current = markerLib;

        const map = new mapsLib.Map(mapElementRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapRef.current = map;

        const infoWindow = new mapsLib.InfoWindow();
        infoWindowRef.current = infoWindow;

        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Google Maps failed to load:", error);
        setErrorMessage(
          error && error.message ? error.message : "Unknown error"
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;

      listenersRef.current.forEach((removeListener) => {
        removeListener();
      });
      listenersRef.current = [];

      Object.values(markersRef.current).forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = {};

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }

      markerLibRef.current = null;
      mapRef.current = null;
    };
  }, [configured]);

  // Purple REAL opportunity layer. Only opportunities with a verified market
  // coordinate get a marker, and the coordinate is used exactly as verified
  // (assignOffsets is NOT applied). Each run removes what it created before.
  useEffect(() => {
    if (status !== "ready") {
      return undefined;
    }

    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !markerLib || !infoWindow) {
      return undefined;
    }

    const markers = [];
    const removers = [];

    verifiedOpportunities.forEach((opportunity) => {
      const lat = Number(opportunity.latitude);
      const lng = Number(opportunity.longitude);

      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: lat, lng: lng },
        map: map,
        title:
          (mandiLabels.title || "Market Opportunity") +
          " - " +
          (opportunity.crop || opportunity.commodity || "") +
          " (" +
          (opportunity.betterMarket || "") +
          ")",
        content: buildCircle(MARKET_SIZE + 4, COLORS.opportunity),
        gmpClickable: true,
        zIndex: 6,
      });

      const handleClick = () => {
        infoWindow.setContent(
          buildMandiOpportunityInfoContent(opportunity, mandiLabels)
        );
        infoWindow.open({ map: map, anchor: marker });
      };

      marker.addEventListener("gmp-click", handleClick);
      markers.push(marker);
      removers.push(() => {
        marker.removeEventListener("gmp-click", handleClick);
      });
    });

    return () => {
      removers.forEach((remove) => {
        remove();
      });
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [status, verifiedOpportunities, mandiLabels]);

  // Fictional purple examples, explicitly identified in each popup. These are
  // kept separate from verified mandi opportunities and never affect their
  // validation or empty-state calculation.
  useEffect(() => {
    if (status !== "ready") return undefined;
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !markerLib || !infoWindow) return undefined;

    const markers = [];
    const removers = [];
    MAP_DEMO_OPPORTUNITIES.forEach((opportunity) => {
      const copy = MAP_DEMO_OPPORTUNITY_COPY[opportunity.id] || EMPTY_OBJECT;
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: Number(opportunity.latitude), lng: Number(opportunity.longitude) },
        map,
        title: localizedPair(copy.crop, lang, opportunity.cropKey) + " — " + (lang === "kn" ? "ಸಂಭಾವ್ಯ ಅವಕಾಶ (ಮಾದರಿ)" : "Potential Opportunity (Illustrative)"),
        content: buildCircle(MARKET_SIZE + 4, COLORS.opportunity),
        gmpClickable: true,
        zIndex: 3,
      });
      const onClick = () => {
        infoWindow.setContent(buildDemoOpportunityInfoContent(opportunity, lang));
        infoWindow.open({ map, anchor: marker });
      };
      marker.addEventListener("gmp-click", onClick);
      markers.push(marker);
      removers.push(() => marker.removeEventListener("gmp-click", onClick));
    });

    [[ILLUSTRATIVE_TRADER_ACTIVITY, "trader", COLORS.trader], [ILLUSTRATIVE_MARKET_AREAS, "market", COLORS.market]]
      .forEach(([points, kind, color]) => {
        points.forEach((point) => {
          const title = kind === "trader"
            ? (lang === "kn" ? "ವ್ಯಾಪಾರಿ ಚಟುವಟಿಕೆ (ಮಾದರಿ)" : "Trader Activity (Illustrative)")
            : (lang === "kn" ? "ಮಾರುಕಟ್ಟೆ ಸ್ಥಳ (ಮಾದರಿ)" : "Market Location (Illustrative)");
          const marker = new markerLib.AdvancedMarkerElement({
            position: { lat: Number(point.latitude), lng: Number(point.longitude) },
            map,
            title,
            content: buildCircle(MARKET_SIZE, color),
            gmpClickable: true,
            zIndex: 2,
          });
          const onClick = () => {
            infoWindow.setContent(buildIllustrativeActivityInfo(kind, point.regionId, lang));
            infoWindow.open({ map, anchor: marker });
          };
          marker.addEventListener("gmp-click", onClick);
          markers.push(marker);
          removers.push(() => marker.removeEventListener("gmp-click", onClick));
        });
      });

    return () => {
      removers.forEach((remove) => remove());
      markers.forEach((marker) => { marker.map = null; });
    };
  }, [status, lang]);

  // Farmer listing layer, SELF-FETCH mode: only used when the parent does not
  // pass the farmerListings prop (keeps other pages that use this map working).
  // Fetches active listings from Supabase once the map is ready, then draws
  // one green square marker per listing that has real stored coordinates.
  useEffect(() => {
    if (status !== "ready" || usesPropListings) {
      return undefined;
    }

    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !markerLib || !infoWindow) {
      return undefined;
    }

    let cancelled = false;
    // Markers and listeners created by THIS run only. Clearing them before
    // drawing (and on cleanup) guarantees no duplicates after a refetch.
    let listingMarkers = [];
    let listingRemovers = [];

    const clearListingMarkers = () => {
      listingRemovers.forEach((remove) => {
        remove();
      });
      listingMarkers.forEach((marker) => {
        marker.map = null;
      });
      listingRemovers = [];
      listingMarkers = [];
    };

    async function loadListings() {
      setListingLayer({ state: "loading", shown: 0, skipped: 0, message: "" });

      try {
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, product_name, photo_url, quantity, unit, expected_price, available_date, location, latitude, longitude, status"
          )
          .eq("status", "active");

        if (cancelled) {
          return;
        }
        if (error) {
          throw error;
        }

        // Start from a clean slate so a refetch can never create duplicates
        clearListingMarkers();

        // Listings on the same spot are spread visually (real positions kept)
        const entries = [];
        (data || []).forEach((listing) => {
          const position = getListingPosition(listing);
          if (position) {
            entries.push({ id: "L:" + listing.id, position: position, order: 0 });
          }
        });
        const selfSpread = computeSpread(entries, getRegionKeySet());

        let shown = 0;
        const skippedIds = [];

        (data || []).forEach((listing) => {
          const position = getListingPosition(listing);
          if (!position) {
            skippedIds.push(listing.id);
            return;
          }

          const offset = offsetOf(selfSpread, "L:" + listing.id);
          const marker = new markerLib.AdvancedMarkerElement({
            position: position,
            map: map,
            title:
              (listing.product_name || "Farmer listing") +
              " - Farmer Listing" +
              (listing.location ? " (" + listing.location + ")" : ""),
            content: buildSquare(LISTING_SIZE, COLORS.supply, offset.dx, offset.dy),
            gmpClickable: true,
            zIndex: LISTING_Z,
          });

          const handleClick = () => {
            infoWindow.setContent(buildListingInfoContent(listing));
            infoWindow.open({ map: map, anchor: marker });
            if (typeof onListingSelectRef.current === "function") {
              onListingSelectRef.current(listing.id);
            }
          };

          marker.addEventListener("gmp-click", handleClick);

          listingMarkers.push(marker);
          listingRemovers.push(() => {
            marker.removeEventListener("gmp-click", handleClick);
          });
          shown += 1;
        });

        if (skippedIds.length > 0) {
          console.warn(
            "Farmer listings skipped because they have no latitude/longitude:",
            skippedIds
          );
        }

        setListingLayer({
          state: "ready",
          shown: shown,
          skipped: skippedIds.length,
          message: "",
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.error("Could not load farmer listings:", loadError);
        clearListingMarkers();
        setListingLayer({
          state: "error",
          shown: 0,
          skipped: 0,
          message:
            loadError && loadError.message
              ? loadError.message
              : "Unknown error",
        });
      }
    }

    loadListings();

    return () => {
      cancelled = true;
      clearListingMarkers();
    };
  }, [status, usesPropListings]);

  // Farmer listing layer, PROP mode (GREEN markers). The parent passes every
  // active listing, so the map never needs a search to show them. Clicking a
  // marker opens the popup AND tells the parent which listing was selected.
  useEffect(() => {
    if (status !== "ready" || !usesPropListings) {
      return undefined;
    }

    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !markerLib || !infoWindow) {
      return undefined;
    }

    const markers = [];
    const removers = [];
    const ids = [];

    farmerListings.forEach((listing) => {
      const position = getListingPosition(listing);
      if (!position) {
        return;
      }

      const offset = offsetOf(spread, "L:" + listing.id);
      const content = buildSquare(LISTING_SIZE, COLORS.supply, offset.dx, offset.dy);
      rememberBaseLook(content, LISTING_Z);

      const marker = new markerLib.AdvancedMarkerElement({
        position: position,
        map: map,
        title:
          (listing.product_label || listing.product_name || "Farmer listing") +
          " - Farmer Listing" +
          (listing.location_label || listing.location
            ? " (" + (listing.location_label || listing.location) + ")"
            : ""),
        content: content,
        gmpClickable: true,
        zIndex: LISTING_Z,
      });

      const handleClick = () => {
        infoWindow.setContent(
          buildFarmerPopupContent(listing, farmerLabels || EMPTY_OBJECT)
        );
        infoWindow.open({ map: map, anchor: marker });
        if (typeof onListingSelectRef.current === "function") {
          onListingSelectRef.current(listing.id);
        }
      };

      marker.addEventListener("gmp-click", handleClick);
      markers.push(marker);
      removers.push(() => {
        marker.removeEventListener("gmp-click", handleClick);
      });
      listingMarkersRef.current[listing.id] = marker;
      ids.push(listing.id);
    });

    return () => {
      removers.forEach((remove) => {
        remove();
      });
      markers.forEach((marker) => {
        marker.map = null;
      });
      ids.forEach((id) => {
        delete listingMarkersRef.current[id];
      });
    };
  }, [status, usesPropListings, farmerListings, farmerLabels, spread]);

  // Buyer requirement layer ("I Need This", BLUE markers).
  // The data comes from the dashboard (props), so a newly saved requirement
  // appears immediately. Each run removes the markers it created before, so a
  // prop change never leaves duplicates. Only real stored latitude / longitude
  // is used; rows without them are skipped. Clicking a marker opens the popup
  // AND tells the parent which requirement was selected.
  useEffect(() => {
    if (status !== "ready") {
      return undefined;
    }

    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !markerLib || !infoWindow) {
      return undefined;
    }

    const markers = [];
    const removers = [];
    const ids = [];

    (buyerRequirements || EMPTY_LIST).forEach((req) => {
      const position = getListingPosition(req);
      if (!position) {
        return;
      }

      const offset = offsetOf(spread, "R:" + req.id);
      const content = buildRequirementMarker(
        REQUIREMENT_SIZE,
        COLORS.demand,
        offset.dx,
        offset.dy
      );
      rememberBaseLook(content, REQUIREMENT_Z);

      const marker = new markerLib.AdvancedMarkerElement({
        position: position,
        map: map,
        title:
          (req.product_label || req.product_name || "Buyer requirement") +
          " - Buyer Demand",
        content: content,
        gmpClickable: true,
        zIndex: REQUIREMENT_Z,
      });

      const handleClick = () => {
        infoWindow.setContent(
          buildRequirementInfoContent(req, requirementLabels || EMPTY_OBJECT)
        );
        infoWindow.open({ map: map, anchor: marker });
        if (typeof onRequirementSelectRef.current === "function") {
          onRequirementSelectRef.current(req.id);
        }
      };

      marker.addEventListener("gmp-click", handleClick);
      markers.push(marker);
      removers.push(() => {
        marker.removeEventListener("gmp-click", handleClick);
      });
      requirementMarkersRef.current[req.id] = marker;
      ids.push(req.id);
    });

    return () => {
      removers.forEach((remove) => {
        remove();
      });
      markers.forEach((marker) => {
        marker.map = null;
      });
      ids.forEach((id) => {
        delete requirementMarkersRef.current[id];
      });
    };
  }, [status, buyerRequirements, requirementLabels, spread]);

  // Selected marker: highlight the focused green / blue marker (yellow ring),
  // clear the highlight on all others, and pan to it when the selection
  // changes. This effect is declared AFTER the marker layers, so it runs after
  // they have been (re)drawn and the highlight survives data refreshes.
  // The map pans to the marker's REAL position (marker.position).
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) {
      return;
    }

    const hasListingFocus =
      focusedListingId !== null && focusedListingId !== undefined;
    const hasRequirementFocus =
      focusedRequirementId !== null && focusedRequirementId !== undefined;

    Object.keys(listingMarkersRef.current).forEach((id) => {
      setMarkerHighlight(
        listingMarkersRef.current[id],
        hasListingFocus && String(id) === String(focusedListingId)
      );
    });
    Object.keys(requirementMarkersRef.current).forEach((id) => {
      setMarkerHighlight(
        requirementMarkersRef.current[id],
        hasRequirementFocus && String(id) === String(focusedRequirementId)
      );
    });

    let key = "";
    let target = null;
    if (hasListingFocus) {
      key = "listing:" + focusedListingId;
      target = listingMarkersRef.current[focusedListingId] || null;
    } else if (hasRequirementFocus) {
      key = "requirement:" + focusedRequirementId;
      target = requirementMarkersRef.current[focusedRequirementId] || null;
    }

    // Pan only when the selection itself changed (not on every data refresh)
    if (target && target.position && key !== lastFocusKeyRef.current) {
      mapRef.current.panTo(target.position);
    }
    lastFocusKeyRef.current = target ? key : "";
  }, [
    status,
    focusedListingId,
    focusedRequirementId,
    farmerListings,
    buyerRequirements,
  ]);

  // Pan to selected region
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) {
      return;
    }
    if (selectedRegionId === undefined || selectedRegionId === null) {
      return;
    }

    const marker = markersRef.current[selectedRegionId];
    if (!marker || !marker.position) {
      return;
    }

    mapRef.current.panTo(marker.position);
  }, [selectedRegionId, status]);

  if (status === "missing-key") {
    return (
      <div style={containerStyle}>
        <div style={{ ...overlayStyle, background: "#fff4f4", color: "#b00020" }}>
          Google Maps API key is missing. Please set it in your environment
          configuration.
        </div>
      </div>
    );
  }

  // Short message for the farmer listing layer (self-fetch mode only)
  let listingStatusText = "";
  if (status === "ready" && !usesPropListings) {
    if (listingLayer.state === "loading") {
      listingStatusText = "Loading farmer listings...";
    } else if (listingLayer.state === "error") {
      listingStatusText =
        "Could not load farmer listings: " + listingLayer.message;
    } else if (listingLayer.state === "ready") {
      const parts = [];
      parts.push(
        listingLayer.shown +
          (listingLayer.shown === 1 ? " farmer listing" : " farmer listings") +
          " on the map"
      );
      if (listingLayer.skipped > 0) {
        parts.push(
          listingLayer.skipped +
            (listingLayer.skipped === 1 ? " listing needs" : " listings need") +
            " latitude/longitude to appear"
        );
      }
      listingStatusText = parts.join(". ") + ".";
    }
  }

  return (
    <div style={containerStyle}>
      <div ref={mapElementRef} style={mapStyle} />
      {status === "ready" && (
        <div style={legendStyle}>
          {[
            ...LEGEND_ITEMS,
            { key: "map.legend.opportunityDemo", color: COLORS.opportunity },
            ...(verifiedOpportunities.length > 0
              ? [{ key: "map.legend.opportunity", color: COLORS.opportunity }]
              : []),
          ].map((item) => (
            <div key={item.key} style={legendRowStyle}>
              <span style={legendDotStyle(item.color, item.square)} />
              <span>{translate(lang, item.key)}</span>
            </div>
          ))}
        </div>
      )}
      {status === "ready" && verifiedOpportunities.length === 0 && (
        <div style={opportunityStatusStyle} role="status">
          {noVerifiedOpportunitiesText}
        </div>
      )}
      {listingStatusText && (
        <div
          style={{
            ...listingStatusStyle,
            ...(listingLayer.state === "error"
              ? { background: "#fff4f4", color: "#b00020" }
              : {}),
          }}
          role={listingLayer.state === "error" ? "alert" : "status"}
        >
          {listingStatusText}
        </div>
      )}
      {status === "loading" && (
        <div style={overlayStyle}>Loading Google Maps...</div>
      )}
      {status === "error" && (
        <div style={{ ...overlayStyle, background: "#fff4f4", color: "#b00020" }}>
          Failed to load Google Maps.
          {errorMessage ? " " + errorMessage : ""}
        </div>
      )}
    </div>
  );
}

export default GoogleMarketMap;
