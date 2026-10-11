import {
  TOWN_TO_DISTRICT,
  VERIFIED_COMMODITY_UNITS,
  VERIFIED_MARKET_COORDINATES,
  marketCoordinateKey,
  normalizeReferenceKey,
} from "../data/mandiReference";
import {
  MARKET_PRICE_SOURCE_LABEL,
  fetchLiveMandiPrices,
  filterRecentMandiRows,
  getLatestRowsByMarket,
  isValidMandiPriceRow,
  normalizeDistrictName,
  resolveMandiCommodity,
} from "./marketPriceApi";

// Legacy API retained for compatibility. Demo opportunities are disabled.
export const OPPORTUNITY_LABEL = "Potential Market Opportunity";
export function getMarketOpportunities() {
  return [];
}

// ===========================================================================
// REAL ENGINE: live Mandi Price API (Government of India / data.gov.in)
// ===========================================================================

// Comparison guards. These are conservative sanity limits, not market facts:
//  - at least 3 distinct markets must have a comparable row, otherwise there is
//    no group to judge an outlier against;
//  - a row whose price is far from the group's median (below 0.5x or above
//    1.6x) is treated as a probable scale / data error and never used. The live
//    API has no unit field and mixes scales for some commodities;
//  - the better price must beat the local price by at least 2%.
const MIN_COMPARABLE_MARKETS = 3;
const OUTLIER_LOW_RATIO = 0.5;
const OUTLIER_HIGH_RATIO = 1.6;
const MIN_RELATIVE_DIFFERENCE = 0.02;

// Unit tables, used ONLY when a commodity's price unit is verified.
const MASS_UNITS_IN_KG = {
  kg: 1,
  kgs: 1,
  quintal: 100,
  quintals: 100,
  ton: 1000,
  tons: 1000,
  tonne: 1000,
  tonnes: 1000,
};
const COUNT_UNITS_IN_PIECES = {
  piece: 1,
  pieces: 1,
  dozen: 12,
  "1000 pieces": 1000,
};

function unitInfo(unit) {
  const key = normalizeReferenceKey(unit);
  if (Object.prototype.hasOwnProperty.call(MASS_UNITS_IN_KG, key)) {
    return { kind: "mass", factor: MASS_UNITS_IN_KG[key] };
  }
  if (Object.prototype.hasOwnProperty.call(COUNT_UNITS_IN_PIECES, key)) {
    return { kind: "count", factor: COUNT_UNITS_IN_PIECES[key] };
  }
  return null; // bags, litres, anything unknown: never converted
}

function getVerifiedUnit(apiCommodity) {
  const key = normalizeReferenceKey(apiCommodity);
  const names = Object.keys(VERIFIED_COMMODITY_UNITS || {});
  for (let i = 0; i < names.length; i += 1) {
    if (normalizeReferenceKey(names[i]) === key) {
      const entry = VERIFIED_COMMODITY_UNITS[names[i]];
      if (entry && entry.unit && entry.verifiedBy && unitInfo(entry.unit)) {
        return entry.unit;
      }
    }
  }
  return null;
}

function getVerifiedCoordinate(market, district) {
  const entry = (VERIFIED_MARKET_COORDINATES || {})[
    marketCoordinateKey(market, district)
  ];
  if (!entry || !entry.verifiedBy) return null;
  const latitude = Number(entry.latitude);
  const longitude = Number(entry.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

// Town -> { supported, district, state }
function resolveFarmerDistrict(location, districtOverride) {
  const townKey = normalizeReferenceKey(location);
  const towns = Object.keys(TOWN_TO_DISTRICT);
  for (let i = 0; i < towns.length; i += 1) {
    if (normalizeReferenceKey(towns[i]) === townKey) {
      return TOWN_TO_DISTRICT[towns[i]];
    }
  }
  const override = typeof districtOverride === "string" ? districtOverride.trim() : "";
  if (override) {
    return { state: "Karnataka", district: override, supported: true };
  }
  return { state: null, district: null, supported: false };
}

// Farmer quantity -> value of the price difference, only for compatible units.
function scaleDifference(priceDifference, quantity, quantityUnit, priceUnit) {
  if (!priceUnit) return null; // unit not verified: never calculate
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const farmerInfo = unitInfo(quantityUnit);
  const priceInfo = unitInfo(priceUnit);
  if (!farmerInfo || !priceInfo || farmerInfo.kind !== priceInfo.kind) {
    return null; // pieces vs quintal, bags, litres... not compatible
  }
  const priceUnitsOwned = (qty * farmerInfo.factor) / priceInfo.factor;
  return Math.round(priceDifference * priceUnitsOwned);
}

function groupKey(row) {
  return (
    normalizeReferenceKey(row.variety) + "|" + normalizeReferenceKey(row.grade)
  );
}

function slug(text) {
  return normalizeReferenceKey(text).replace(/\s+/g, "-");
}

function emptyResult(status, extra) {
  return Object.assign({ status: status, opportunities: [], message: "" }, extra);
}

/**
 * Real Market Opportunity for ONE farmer listing, from live mandi prices.
 *
 * input:   { listingId?, crop, quantity, quantityUnit, location, district? }
 * options: { signal?, now?, forceRefresh? }
 *
 * Returns (never throws):
 *   {
 *     status: "ok" | "no-opportunity" | "no-recent-data" | "insufficient-data"
 *           | "unsupported-location" | "unsupported-crop" | "error",
 *     opportunities: [] or [ one opportunity ],
 *     message: detail for "error" only,
 *     checkedAt, commodity, farmerDistrict
 *   }
 *
 * This is "potential price difference" only: transport, commission, spoilage
 * and other costs are NOT included, and it is never called profit.
 */
export async function getMandiOpportunities(input, options = {}) {
  const {
    listingId = null,
    crop = "",
    quantity = null,
    quantityUnit = "",
    location = "",
    district = "",
  } = input || {};
  const now = options.now || new Date();
  const checkedAt = now.toISOString();

  // 1-2. farmer town -> district; reject non-Karnataka / unknown locations
  const farmer = resolveFarmerDistrict(location, district);
  if (!farmer.supported || !farmer.district) {
    return emptyResult("unsupported-location", { checkedAt });
  }

  // 3. crop -> API commodity name
  const { apiName, aliasMatched } = resolveMandiCommodity(crop);
  if (!apiName) {
    return emptyResult("unsupported-crop", { checkedAt });
  }

  // 4. live Karnataka rows
  const live = await fetchLiveMandiPrices(
    { commodity: apiName, state: "Karnataka" },
    { signal: options.signal, forceRefresh: options.forceRefresh }
  );
  if (live.error) {
    return emptyResult("error", {
      checkedAt,
      commodity: apiName,
      message: live.error.message || "",
      aborted: live.error.name === "AbortError",
    });
  }

  // Same commodity + Karnataka only (the API may do looser matching)
  const wantedCommodity = normalizeReferenceKey(apiName);
  const karnatakaRows = live.rows.filter(
    (row) =>
      normalizeReferenceKey(row.commodity) === wantedCommodity &&
      normalizeReferenceKey(row.state) === "karnataka"
  );
  if (karnatakaRows.length === 0) {
    return emptyResult(aliasMatched ? "no-recent-data" : "unsupported-crop", {
      checkedAt,
      commodity: apiName,
      farmerDistrict: farmer.district,
    });
  }

  // 5-6. valid rows, STRICT 7-day rule, latest row per market+variety+grade
  const recentRows = getLatestRowsByMarket(
    filterRecentMandiRows(karnatakaRows.filter(isValidMandiPriceRow), { now })
  );
  const farmerDistrictKey = normalizeDistrictName(farmer.district);
  const hasLocalRows = recentRows.some(
    (row) => normalizeDistrictName(row.district) === farmerDistrictKey
  );
  if (recentRows.length === 0 || !hasLocalRows) {
    return emptyResult("no-recent-data", {
      checkedAt,
      commodity: apiName,
      farmerDistrict: farmer.district,
    });
  }

  // 7. compare only rows of the SAME variety + grade
  const groups = new Map();
  recentRows.forEach((row) => {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const priceUnit = getVerifiedUnit(apiName);
  let best = null;
  let evaluatedGroup = false;

  groups.forEach((groupRows) => {
    const localRows = groupRows.filter(
      (row) => normalizeDistrictName(row.district) === farmerDistrictKey
    );
    if (localRows.length === 0) return;

    const marketKeys = new Set(
      groupRows.map((row) => normalizeReferenceKey(row.market) + "|" + normalizeDistrictName(row.district))
    );
    if (marketKeys.size < MIN_COMPARABLE_MARKETS) return;

    // outlier guard against the group's own median
    const prices = groupRows.map((row) => row.modal_price).sort((a, b) => a - b);
    const groupMedian = median(prices);
    const inliers = groupRows.filter(
      (row) =>
        row.modal_price >= groupMedian * OUTLIER_LOW_RATIO &&
        row.modal_price <= groupMedian * OUTLIER_HIGH_RATIO
    );

    // local reference: the farmer's district, newest date, then the higher
    // price (the cautious choice: it gives the smaller difference)
    const localInliers = inliers.filter(
      (row) => normalizeDistrictName(row.district) === farmerDistrictKey
    );
    if (localInliers.length === 0) return;
    localInliers.sort((a, b) => {
      if (a.arrival_date !== b.arrival_date) return a.arrival_date < b.arrival_date ? 1 : -1;
      return b.modal_price - a.modal_price;
    });
    const local = localInliers[0];

    evaluatedGroup = true;

    // other Karnataka markets (other districts), plausible rows only
    const others = inliers.filter(
      (row) => normalizeDistrictName(row.district) !== farmerDistrictKey
    );
    others.sort((a, b) => b.modal_price - a.modal_price);
    const better = others.length > 0 ? others[0] : null;
    if (!better) return;

    const difference = better.modal_price - local.modal_price;
    if (difference <= 0 || difference < local.modal_price * MIN_RELATIVE_DIFFERENCE) {
      return;
    }

    const candidate = {
      local,
      better,
      difference,
      marketCount: marketKeys.size,
      relative: difference / local.modal_price,
    };
    if (
      !best ||
      candidate.marketCount > best.marketCount ||
      (candidate.marketCount === best.marketCount && candidate.relative > best.relative)
    ) {
      best = candidate;
    }
  });

  if (!best) {
    return emptyResult(evaluatedGroup ? "no-opportunity" : "insufficient-data", {
      checkedAt,
      commodity: apiName,
      farmerDistrict: farmer.district,
    });
  }

  // 8-15. build the opportunity (units / coordinates only when verified)
  const { local, better, difference } = best;
  const coordinate = getVerifiedCoordinate(better.market, better.district);
  const potentialPriceDifference = scaleDifference(
    difference,
    quantity,
    quantityUnit,
    priceUnit
  );
  const quantityNumber = Number(quantity);

  const opportunity = {
    id: [
      "mandi",
      listingId === null || listingId === undefined ? "listing" : listingId,
      slug(apiName),
      slug(local.market),
      slug(better.market),
      slug(better.variety),
      slug(better.grade),
    ].join("-"),
    listingId: listingId,
    crop: crop,
    commodity: apiName,
    farmerLocation: location,
    farmerDistrict: farmer.district,
    localMarket: local.market,
    localDistrict: local.district,
    localPrice: local.modal_price,
    localPriceUnit: priceUnit,
    betterMarket: better.market,
    betterMarketDistrict: better.district,
    betterPrice: better.modal_price,
    priceDifference: difference,
    priceUnit: priceUnit,
    unitVerified: Boolean(priceUnit),
    farmerQuantity: Number.isFinite(quantityNumber) ? quantityNumber : null,
    farmerQuantityUnit: quantityUnit || null,
    potentialPriceDifference: potentialPriceDifference,
    variety: better.variety,
    grade: better.grade,
    comparedMarketCount: best.marketCount,
    localArrivalDate: local.arrival_date,
    arrivalDate: better.arrival_date,
    fetchedAt: better.fetched_at,
    source: MARKET_PRICE_SOURCE_LABEL,
    sourceType: "live-api",
    verifiedCoordinate: Boolean(coordinate),
    latitude: coordinate ? coordinate.latitude : null,
    longitude: coordinate ? coordinate.longitude : null,
    reason:
      "Latest observed modal price of " +
      better.modal_price +
      " at " +
      better.market +
      " (" +
      better.district +
      ") is " +
      difference +
      " higher than " +
      local.modal_price +
      " at " +
      local.market +
      ". Same variety/grade compared across " +
      best.marketCount +
      " markets; " +
      (priceUnit ? "unit: per " + priceUnit + "." : "price unit not verified."),
    isPrototype: false,
  };

  return {
    status: "ok",
    opportunities: [opportunity],
    message: "",
    checkedAt,
    commodity: apiName,
    farmerDistrict: farmer.district,
  };
}

/**
 * Evaluates several farmer listings (one live request per distinct crop; the
 * API layer caches it). Returns [{ listingId, input, ...result }].
 * Listings are evaluated one after another so the API is not flooded.
 */
export async function getMandiOpportunitiesForListings(inputs, options = {}) {
  const list = Array.isArray(inputs) ? inputs : [];
  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    if (options.signal && options.signal.aborted) break;
    const result = await getMandiOpportunities(list[i], options);
    results.push(Object.assign({ listingId: list[i].listingId, input: list[i] }, result));
  }
  return results;
}

export default getMarketOpportunities;
