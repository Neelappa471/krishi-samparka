// src/data/mandiReference.js
//
// Small, AUDITABLE reference tables for the real mandi-price feature.
// Rule for this file: only put a fact here if it has actually been verified.
// If something is not in a table, the app shows "unit not verified" / skips the
// map marker instead of guessing.

// Lower-cases, strips punctuation and collapses spaces. Works for Kannada too.
// "Arecanut(Betelnut/Supari)" -> "arecanut betelnut supari"
export function normalizeReferenceKey(value) {
  return String(value === null || value === undefined ? "" : value)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// 1. Commodity aliases: farmer-facing name -> exact name used by the Mandi API
// ---------------------------------------------------------------------------
// Verified against https://mandi-api.onrender.com :
//   - "Coconut" returns rows for ?commodity=Coconut
//   - "Arecanut(Betelnut/Supari)" is listed by /v1/commodities
// /v1/commodities is INCOMPLETE (it did not list Coconut), so it is never the
// only source of valid names. A crop that is not in this table is still tried
// with the farmer's own spelling, and is reported as "unsupported crop" if the
// API returns no rows for it.
export const MANDI_COMMODITY_ALIASES = {
  Coconut: ["coconut", "coconuts", "tengina kayi", "ತೆಂಗಿನಕಾಯಿ", "ತೆಂಗು"],
  "Arecanut(Betelnut/Supari)": [
    "arecanut",
    "areca nut",
    "areca",
    "betelnut",
    "betel nut",
    "supari",
    "adike",
    "ಅಡಿಕೆ",
  ],
};

// ---------------------------------------------------------------------------
// 2. Farmer town -> district (the towns offered in Krishi Samparka's location list)
// ---------------------------------------------------------------------------
// supported: true  -> Karnataka town, can be compared against Karnataka mandis
// supported: false -> outside Karnataka, no Karnataka mandi comparison is made
export const TOWN_TO_DISTRICT = {
  Udupi: { state: "Karnataka", district: "Udupi", supported: true },
  Mangaluru: { state: "Karnataka", district: "Dakshina Kannada", supported: true },
  Kundapura: { state: "Karnataka", district: "Udupi", supported: true },
  Karkala: { state: "Karnataka", district: "Udupi", supported: true },
  Puttur: { state: "Karnataka", district: "Dakshina Kannada", supported: true },
  Belthangady: { state: "Karnataka", district: "Dakshina Kannada", supported: true },
  Sullia: { state: "Karnataka", district: "Dakshina Kannada", supported: true },
  Moodabidri: { state: "Karnataka", district: "Dakshina Kannada", supported: true },
  Bengaluru: { state: "Karnataka", district: "Bengaluru", supported: true },
  Mysuru: { state: "Karnataka", district: "Mysuru", supported: true },
  Kasaragod: { state: "Kerala", district: null, supported: false },
  Mumbai: { state: "Maharashtra", district: null, supported: false },
};

// ---------------------------------------------------------------------------
// 3. Verified price units (what the mandi price of a commodity is PER)
// ---------------------------------------------------------------------------
// The Mandi API has NO unit field, and Coconut rows mix very different scales
// (some ~20,000, some ~2,000, some ~20), so no unit is assumed.
//
// EMPTY ON PURPOSE. Add an entry ONLY after you have verified the unit from an
// official source, together with a note saying where it was verified:
//
//   "Arecanut(Betelnut/Supari)": {
//     unit: "quintal",                      // kg | quintal | ton | piece | dozen | "1000 pieces"
//     verifiedBy: "<link or document that states the unit>",
//   },
//
// Until an entry exists the app compares prices "as reported", shows
// "Unit not verified", and does NOT calculate a quantity-based total.
export const VERIFIED_COMMODITY_UNITS = {};

// ---------------------------------------------------------------------------
// 4. Verified market (APMC yard) coordinates
// ---------------------------------------------------------------------------
// EMPTY ON PURPOSE. Town-centre coordinates are NOT APMC coordinates, and none
// have been verified yet, so no purple marker is drawn for real mandi
// opportunities (they still appear in the opportunity cards).
//
// Key format: marketCoordinateKey(market, district). Add entries like:
//
//   "sulya apmc|dakshina kannada": {
//     latitude: 0.0,                         // <- real, verified value
//     longitude: 0.0,                        // <- real, verified value
//     verifiedBy: "<link or document that states the location>",
//   },
export const VERIFIED_MARKET_COORDINATES = {};

export function marketCoordinateKey(market, district) {
  return normalizeReferenceKey(market) + "|" + normalizeReferenceKey(district);
}
