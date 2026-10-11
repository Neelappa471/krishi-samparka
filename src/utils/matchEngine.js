// ---------------------------------------------------------------------------
// Krishi Samparka matching engine.
//
// Deterministic and transparent: pure JavaScript, no network, no randomness, no
// AI. The same input always gives the same output, and every result carries the
// numbers and score breakdown that produced it.
//
//   findSupplyMatches(requirement, listings)   BUYER side: which farmers (one or
//                                              several together) can cover this
//                                              buyer requirement?
//   findDemandMatches(listing, requirements)   FARMER side: which buyers (one or
//                                              several together) want this listing?
//
// Quantities may be split: 12 kg + 3 kg + 19 kg can cover a 34 kg requirement,
// and part of one listing can be used (for example 22 of 30 kg).
// Nothing is invented: only the rows passed in are ever used.
// ---------------------------------------------------------------------------

// ---- scoring (total 100) ----------------------------------------------------
export const WEIGHTS = {
  coverage: 40, // how much of the required quantity the combination covers
  price: 25, // effective price (see PRICE_LOSS_PER_PERCENT)
  distance: 15, // weighted average distance to the anchor
  date: 10, // on-time buffer before the required date
  participants: 10, // fewer participants is simpler to arrange
};

// A combination covering at least this share of the quantity is a "partial
// match". Below it the result is "no complete match" (the available quantity is
// still reported).
export const PARTIAL_MIN_COVERAGE = 0.5;

export const MAX_GROUPS = 5; // ranked combinations returned
export const MAX_POOL = 16; // candidates compared exhaustively (2^16 subsets)

const PRICE_SPREAD_PERCENT = 25; // 25 points for the best price, minus 1 point per 1% worse, 0 at 25% worse
const DISTANCE_FULL_KM = 150; // 0 km = full points, 150 km or more = 0 points
const DATE_BUFFER_DAYS = 3; // full points when available 3+ days before the required date
const PARTICIPANT_STEP = 2; // minus 2 points per additional participant
const NEUTRAL = 0.5; // share of the points given when a factor cannot be known
const EPS = 1e-6;

// ---- units ------------------------------------------------------------------
// Only units in the same family are compared. Nothing is guessed across families
// (for example bags and kilograms).
const UNIT_FAMILIES = {
  kg: { family: "weight", factor: 1 },
  quintal: { family: "weight", factor: 100 },
  ton: { family: "weight", factor: 1000 },
  pieces: { family: "count", factor: 1 },
  dozen: { family: "count", factor: 12 },
  bags: { family: "bags", factor: 1 },
  litres: { family: "volume", factor: 1 },
};

export function unitInfo(unit) {
  const key = String(unit || "").trim().toLowerCase();
  return UNIT_FAMILIES[key] || { family: "unit:" + key, factor: 1 };
}

// ---- product names ------------------------------------------------------------
// Product names are free text, so they are compared after normalising (lower
// case, trimmed) and through this alias list. No fuzzy guessing: a name that is
// not here is only equal to itself.
const PRODUCT_ALIASES = {
  tomato: ["tomato", "tomatoes", "ಟೊಮೆಟೊ", "ಟೊಮ್ಯಾಟೊ", "ಟೊಮ್ಯಾಟೋ", "ಟೊಮೇಟೊ"],
  coconut: ["coconut", "coconuts", "ತೆಂಗಿನಕಾಯಿ", "ತೆಂಗು"],
  arecanut: ["arecanut", "arecanuts", "areca nut", "areca nuts", "betel nut", "ಅಡಿಕೆ"],
  onion: ["onion", "onions", "ಈರುಳ್ಳಿ"],
  potato: ["potato", "potatoes", "ಆಲೂಗಡ್ಡೆ"],
  banana: ["banana", "bananas", "ಬಾಳೆಹಣ್ಣು"],
  mango: ["mango", "mangoes", "mangos", "ಮಾವಿನಹಣ್ಣು", "ಮಾವು"],
  rice: ["rice", "ಅಕ್ಕಿ"],
  chilli: ["chilli", "chillies", "chili", "chilies", "ಮೆಣಸಿನಕಾಯಿ"],
  ginger: ["ginger", "ಶುಂಠಿ"],
};

const ALIAS_INDEX = {};
Object.keys(PRODUCT_ALIASES).forEach((canonical) => {
  PRODUCT_ALIASES[canonical].forEach((alias) => {
    ALIAS_INDEX[alias.toLowerCase()] = canonical;
  });
});

export function normalizeProduct(name) {
  const cleaned = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  return ALIAS_INDEX[cleaned] || cleaned;
}

// ---- small helpers ------------------------------------------------------------
function r6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// "2026-10-10" -> whole day number (no time zone effects)
function dayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) {
    return null;
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
}

// Great-circle distance in km between two points
export function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nullLast(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function idCompare(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

// ---- adapters: database row -> engine item ------------------------------------
// extra.coords = { latitude, longitude } or null (never invented here),
// extra.name   = the person's display name (optional)
function coordsOf(extra) {
  const coords = extra && extra.coords;
  if (
    coords &&
    toNumber(coords.latitude) !== null &&
    toNumber(coords.longitude) !== null
  ) {
    return { lat: Number(coords.latitude), lng: Number(coords.longitude) };
  }
  return null;
}

// A farmer listing (public.listings)
export function normalizeListing(row, extra = {}) {
  const coords = coordsOf(extra);
  return {
    kind: "listing",
    id: row.id,
    name: extra.name || "",
    productName: row.product_name || "",
    unit: row.unit || "",
    quantity: toNumber(row.quantity),
    price: toNumber(row.expected_price), // farmer's expected price per unit
    date: row.available_date || null, // available from
    location: row.location || "",
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
  };
}

// A buyer requirement (public.buyer_requirements). buyer_id is never needed.
export function normalizeRequirement(row, extra = {}) {
  const coords = coordsOf(extra);
  return {
    kind: "requirement",
    id: row.id,
    name: extra.name || "",
    productName: row.product_name || "",
    unit: row.unit || "",
    quantity: toNumber(row.quantity),
    price: toNumber(row.max_price), // buyer's maximum price per unit
    date: row.required_date || null, // needed by
    location: row.location || "",
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
  };
}

// engine item + unit conversion into the family's base unit
function prepare(item, anchor) {
  const info = unitInfo(item.unit);
  const quantity = item.quantity;
  const prepared = {
    ...item,
    family: info.family,
    factor: info.factor,
    product: normalizeProduct(item.productName),
    qtyBase: quantity !== null && quantity > 0 ? r6(quantity * info.factor) : 0,
    priceBase: item.price !== null && item.price >= 0 ? item.price / info.factor : null,
    day: dayNumber(item.date),
    distanceKm: null,
  };
  if (anchor && anchor.lat !== null && anchor.lng !== null && item.lat !== null && item.lng !== null) {
    prepared.distanceKm = distanceKm(anchor.lat, anchor.lng, item.lat, item.lng);
  }
  return prepared;
}

// ---- public API -----------------------------------------------------------------
export function findSupplyMatches(requirement, listings, options) {
  return buildMatches("supply", requirement, listings || [], options);
}

export function findDemandMatches(listing, requirements, options) {
  return buildMatches("demand", listing, requirements || [], options);
}

// ---- core -------------------------------------------------------------------------
function buildMatches(side, anchorItem, rawItems, options) {
  const opts = { maxGroups: MAX_GROUPS, maxPool: MAX_POOL, ...(options || {}) };
  const anchor = prepare(anchorItem, null);
  const anchorFactor = anchor.factor;

  const result = {
    side: side,
    anchor: {
      id: anchor.id,
      productName: anchor.productName,
      unit: anchor.unit,
      quantity: anchor.quantity,
      price: anchor.price,
      date: anchor.date,
      location: anchor.location,
      hasCoordinates: anchor.lat !== null && anchor.lng !== null,
    },
    displayUnit: anchor.unit,
    required: anchor.quantity,
    status: "none", // "complete" | "partial" | "none"
    availableQuantity: 0, // everything eligible, in the anchor's unit
    eligibleCount: 0,
    evaluatedCount: 0,
    exhaustive: true,
    groups: [],
    best: null,
    excluded: [],
  };

  if (anchor.qtyBase <= 0) {
    return result;
  }

  // Anchor coordinates for distance
  const anchorPoint = { lat: anchor.lat, lng: anchor.lng };

  // 1. eligibility ---------------------------------------------------------------
  const excludedBy = {
    unit: { count: 0, base: 0, convertible: false },
    price: { count: 0, base: 0, convertible: true },
    date: { count: 0, base: 0, convertible: true },
  };
  const eligible = [];

  rawItems.forEach((raw) => {
    const item = prepare(raw, anchorPoint);
    if (item.product !== anchor.product || item.qtyBase <= 0) {
      return; // a different product (or empty): not relevant at all
    }

    let reason = null;
    if (item.family !== anchor.family) {
      reason = "unit";
    } else if (side === "supply") {
      // farmer's price must be known and not above the buyer's maximum
      if (item.priceBase === null) {
        reason = "price";
      } else if (anchor.priceBase !== null && item.priceBase > anchor.priceBase + 1e-9) {
        reason = "price";
      }
    } else if (
      // buyer's maximum (when stated) must reach the farmer's price
      item.priceBase !== null &&
      anchor.priceBase !== null &&
      anchor.priceBase > item.priceBase + 1e-9
    ) {
      reason = "price";
    }

    if (!reason && anchor.day !== null && item.day !== null) {
      // supply: farmer must be available by the day the buyer needs it
      // demand: the listing must be available by the day the buyer needs it
      const late = side === "supply" ? item.day > anchor.day : anchor.day > item.day;
      if (late) {
        reason = "date";
      }
    }

    if (reason) {
      excludedBy[reason].count += 1;
      excludedBy[reason].base += item.qtyBase;
      return;
    }
    eligible.push(item);
  });

  result.excluded = ["price", "date", "unit"]
    .filter((reason) => excludedBy[reason].count > 0)
    .map((reason) => ({
      reason: reason,
      count: excludedBy[reason].count,
      quantity: excludedBy[reason].convertible
        ? round(excludedBy[reason].base / anchorFactor, 4)
        : null,
    }));

  result.eligibleCount = eligible.length;
  const availableBase = eligible.reduce((sum, item) => sum + item.qtyBase, 0);
  result.availableQuantity = round(availableBase / anchorFactor, 4);

  if (eligible.length === 0) {
    return result;
  }

  // 2. candidate combinations ---------------------------------------------------------
  let candidates;
  if (availableBase < anchor.qtyBase - EPS) {
    // Not enough in total: the most that can be covered is everything eligible.
    candidates = [eligible.map((item) => ({ item: item, takeBase: item.qtyBase }))];
  } else {
    const generated = coverCandidates(eligible, anchor, side, opts);
    candidates = generated.candidates;
    result.exhaustive = generated.exhaustive;
  }
  result.evaluatedCount = candidates.length;

  // 3. evaluate + score + rank -----------------------------------------------------------
  const groups = candidates.map((parts) => evaluateGroup(parts, anchor, side));
  scoreGroups(groups, side, result.displayUnit);
  groups.sort(compareGroups(side));

  groups.forEach((group, index) => {
    group.rank = index + 1;
  });

  result.groups = groups.slice(0, opts.maxGroups);
  result.best = result.groups[0] || null;
  if (result.best) {
    result.status = result.best.status === "insufficient" ? "none" : result.best.status;
  }
  return result;
}

// ---- generating combinations ------------------------------------------------------------
function compareFill(side) {
  return (a, b) => {
    let c = 0;
    if (a.priceBase !== b.priceBase) {
      if (a.priceBase === null) c = 1;
      else if (b.priceBase === null) c = -1;
      // supply: cheapest farmer first. demand: highest buyer maximum first
      else c = side === "supply" ? a.priceBase - b.priceBase : b.priceBase - a.priceBase;
    }
    return c || nullLast(a.distanceKm, b.distanceKm) || nullLast(a.day, b.day) || idCompare(a, b);
  };
}

// Fill the target using the items in fill order: whole items first, the last one
// may be used partly. Returns null if the items cannot cover the target.
function allocate(items, target, side) {
  const ordered = items.slice().sort(compareFill(side));
  let remaining = target;
  const parts = [];
  for (let i = 0; i < ordered.length && remaining > EPS; i += 1) {
    const take = r6(Math.min(ordered[i].qtyBase, remaining));
    parts.push({ item: ordered[i], takeBase: take });
    remaining = r6(remaining - take);
  }
  return remaining <= EPS ? parts : null;
}

function signature(parts) {
  return parts
    .map((part) => part.item.id + ":" + part.takeBase)
    .sort()
    .join("|");
}

// Drop members that are not needed to reach the target (least preferred first)
function dropRedundant(items, target, side) {
  const fill = compareFill(side);
  let kept = items.slice();
  let total = kept.reduce((sum, item) => sum + item.qtyBase, 0);
  kept
    .slice()
    .sort(fill)
    .reverse()
    .forEach((item) => {
      if (total - item.qtyBase >= target - EPS) {
        kept = kept.filter((other) => other !== item);
        total -= item.qtyBase;
      }
    });
  return kept;
}

// When there are many eligible items, compare the best POOL_SIZE of them
// exhaustively; ranking uses an average of price, distance, date and size ranks.
function pickPool(items, size, side) {
  const rankBy = (compare) => {
    const order = items.slice().sort(compare);
    const ranks = new Map();
    order.forEach((item, index) => ranks.set(item, index));
    return ranks;
  };
  const byPrice = rankBy((a, b) => compareFill(side)(a, b));
  const byDistance = rankBy((a, b) => nullLast(a.distanceKm, b.distanceKm) || idCompare(a, b));
  const byDate = rankBy((a, b) => nullLast(a.day, b.day) || idCompare(a, b));
  const bySize = rankBy((a, b) => b.qtyBase - a.qtyBase || idCompare(a, b));
  return items
    .slice()
    .sort((a, b) => {
      const ra = byPrice.get(a) + byDistance.get(a) + byDate.get(a) + bySize.get(a);
      const rb = byPrice.get(b) + byDistance.get(b) + byDate.get(b) + bySize.get(b);
      return ra - rb || idCompare(a, b);
    })
    .slice(0, size)
    .sort(idCompare);
}

function coverCandidates(eligible, anchor, side, opts) {
  const target = anchor.qtyBase;
  const found = new Map();
  const add = (parts) => {
    if (parts) {
      const key = signature(parts);
      if (!found.has(key)) {
        found.set(key, parts);
      }
    }
  };

  const sorted = eligible.slice().sort(idCompare);
  let pool = sorted;
  let exhaustive = true;
  if (sorted.length > opts.maxPool) {
    pool = pickPool(sorted, opts.maxPool, side);
    exhaustive = false;
  }

  // Every MINIMAL set of pool members that covers the target (no member could be
  // dropped), each filled in price order. Exact fits such as 12 + 3 + 19 = 34
  // are among them.
  const n = pool.length;
  const quantities = pool.map((item) => item.qtyBase);
  const sums = new Float64Array(1 << n);
  const mins = new Float64Array(1 << n);
  for (let mask = 1; mask < 1 << n; mask += 1) {
    const low = mask & -mask;
    const index = 31 - Math.clz32(low);
    const rest = mask ^ low;
    sums[mask] = sums[rest] + quantities[index];
    mins[mask] = rest ? Math.min(mins[rest], quantities[index]) : quantities[index];
    if (sums[mask] >= target - EPS && sums[mask] - mins[mask] < target - EPS) {
      const members = [];
      for (let i = 0; i < n; i += 1) {
        if (mask & (1 << i)) members.push(pool[i]);
      }
      add(allocate(members, target, side));
    }
  }

  // With many candidates also try classic strategies over ALL of them.
  if (!exhaustive) {
    const strategies = [
      compareFill(side),
      (a, b) => nullLast(a.distanceKm, b.distanceKm) || compareFill(side)(a, b),
      (a, b) => b.qtyBase - a.qtyBase || idCompare(a, b),
      (a, b) => nullLast(a.day, b.day) || compareFill(side)(a, b),
    ];
    strategies.forEach((strategy) => {
      const ordered = sorted.slice().sort(strategy);
      const chosen = [];
      let total = 0;
      for (let i = 0; i < ordered.length && total < target - EPS; i += 1) {
        chosen.push(ordered[i]);
        total += ordered[i].qtyBase;
      }
      add(allocate(dropRedundant(chosen, target, side), target, side));
    });
  }

  return { candidates: Array.from(found.values()), exhaustive: exhaustive };
}

// ---- evaluating a combination ---------------------------------------------------------------
function evaluateGroup(parts, anchor, side) {
  const factor = anchor.factor;
  const anchorPriceBase = anchor.priceBase;
  const matchedBase = r6(parts.reduce((sum, part) => sum + part.takeBase, 0));
  const targetBase = anchor.qtyBase;

  let totalPrice = 0; // supply: what the buyer would pay; demand: value at the farmer's price
  let priceKnown = true;
  let offerTotal = 0; // demand only: buyers' maximum
  let offerKnown = true;
  let distanceWeight = 0;
  let distanceSum = 0;
  let dateWeight = 0;
  let dateSum = 0;

  const participants = parts.map((part) => {
    const item = part.item;
    const takeBase = part.takeBase;

    let subtotal = null;
    let offerSubtotal = null;
    if (side === "supply") {
      subtotal = item.priceBase !== null ? takeBase * item.priceBase : null;
    } else {
      subtotal = anchorPriceBase !== null ? takeBase * anchorPriceBase : null;
      offerSubtotal = item.priceBase !== null ? takeBase * item.priceBase : null;
    }
    if (subtotal === null) priceKnown = false;
    else totalPrice += subtotal;
    if (side === "demand") {
      if (offerSubtotal === null) offerKnown = false;
      else offerTotal += offerSubtotal;
    }

    if (item.distanceKm !== null) {
      distanceWeight += takeBase;
      distanceSum += takeBase * item.distanceKm;
    }

    let daysEarly = null;
    if (anchor.day !== null && item.day !== null) {
      daysEarly = side === "supply" ? anchor.day - item.day : item.day - anchor.day;
      dateWeight += takeBase;
      dateSum += takeBase * Math.max(0, daysEarly);
    }

    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      productName: item.productName,
      location: item.location,
      lat: item.lat,
      lng: item.lng,
      quantity: round(takeBase / factor, 4),
      offeredQuantity: round(item.qtyBase / factor, 4),
      isPartialOfItem: takeBase < item.qtyBase - EPS,
      // supply: this farmer's price; demand: the farmer's own price
      unitPrice:
        side === "supply"
          ? item.priceBase !== null ? round(item.priceBase * factor, 4) : null
          : anchorPriceBase !== null ? round(anchorPriceBase * factor, 4) : null,
      // demand only: this buyer's stated maximum per unit
      offerPrice:
        side === "demand" && item.priceBase !== null ? round(item.priceBase * factor, 4) : null,
      subtotal: subtotal !== null ? round(subtotal, 2) : null,
      offerSubtotal: offerSubtotal !== null ? round(offerSubtotal, 2) : null,
      date: item.date,
      daysEarly: daysEarly,
      distanceKm: item.distanceKm !== null ? round(item.distanceKm, 1) : null,
    };
  });

  const coverage = Math.min(1, matchedBase / targetBase);
  const matched = round(matchedBase / factor, 4);
  const effectivePrice =
    priceKnown && matchedBase > 0 ? round((totalPrice / matchedBase) * factor, 4) : null;
  const avgOfferPrice =
    side === "demand" && offerKnown && matchedBase > 0
      ? round((offerTotal / matchedBase) * factor, 4)
      : null;

  let status = "complete";
  if (coverage < 1 - EPS) {
    status = coverage >= PARTIAL_MIN_COVERAGE ? "partial" : "insufficient";
  }

  return {
    id: signature(parts),
    rank: 0,
    status: status,
    participants: participants,
    participantCount: participants.length,
    requiredQuantity: anchor.quantity,
    matchedQuantity: matched,
    coverage: round(coverage, 4),
    totalPrice: priceKnown ? round(totalPrice, 2) : null,
    effectivePrice: effectivePrice,
    maxTotal: side === "demand" && offerKnown ? round(offerTotal, 2) : null,
    avgOfferPrice: avgOfferPrice,
    avgDistanceKm: distanceWeight > 0 ? round(distanceSum / distanceWeight, 1) : null,
    distanceKnownCount: participants.filter((p) => p.distanceKm !== null).length,
    avgDaysEarly: dateWeight > 0 ? round(dateSum / dateWeight, 1) : null,
    score: 0,
    breakdown: [],
  };
}

// ---- scoring ---------------------------------------------------------------------------------
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function priceMetric(group, side) {
  return side === "supply" ? group.effectivePrice : group.avgOfferPrice;
}

function scoreGroups(groups, side) {
  // The price factor is measured against the best price among the combinations
  // compared (lowest cost for buyers, highest buyer maximum for farmers).
  const known = groups.map((group) => priceMetric(group, side)).filter((value) => value !== null);
  let best = null;
  if (known.length > 0) {
    best = side === "supply" ? Math.min(...known) : Math.max(...known);
  }

  groups.forEach((group) => {
    const breakdown = [];

    // 1. coverage
    breakdown.push({
      factor: "coverage",
      points: round(WEIGHTS.coverage * group.coverage, 1),
      max: WEIGHTS.coverage,
      detail: {
        key: "match.detail.coverage",
        params: { matched: group.matchedQuantity, required: group.requiredQuantity },
      },
    });

    // 2. price
    const metric = priceMetric(group, side);
    if (metric === null || best === null) {
      breakdown.push({
        factor: "price",
        points: round(WEIGHTS.price * NEUTRAL, 1),
        max: WEIGHTS.price,
        detail: { key: "match.detail.priceUnknown", params: {} },
      });
    } else {
      let percentWorse = 0;
      if (best > 0) {
        percentWorse = side === "supply" ? ((metric - best) / best) * 100 : ((best - metric) / best) * 100;
      } else if (side === "supply" && metric > 0) {
        percentWorse = 100;
      }
      percentWorse = Math.max(0, percentWorse);
      const points = WEIGHTS.price * clamp01(1 - percentWorse / PRICE_SPREAD_PERCENT);
      breakdown.push({
        factor: "price",
        points: round(points, 1),
        max: WEIGHTS.price,
        detail:
          percentWorse < 0.05
            ? { key: "match.detail.priceBest." + side, params: {} }
            : { key: "match.detail.priceWorse." + side, params: { pct: round(percentWorse, 1) } },
      });
    }

    // 3. distance
    if (group.avgDistanceKm === null) {
      breakdown.push({
        factor: "distance",
        points: round(WEIGHTS.distance * NEUTRAL, 1),
        max: WEIGHTS.distance,
        detail: { key: "match.detail.distanceUnknown", params: {} },
      });
    } else {
      breakdown.push({
        factor: "distance",
        points: round(WEIGHTS.distance * clamp01(1 - group.avgDistanceKm / DISTANCE_FULL_KM), 1),
        max: WEIGHTS.distance,
        detail:
          group.avgDistanceKm < 0.05
            ? { key: "match.detail.distanceSame", params: {} }
            : { key: "match.detail.distance", params: { km: group.avgDistanceKm } },
      });
    }

    // 4. date
    if (group.avgDaysEarly === null) {
      breakdown.push({
        factor: "date",
        points: round(WEIGHTS.date * NEUTRAL, 1),
        max: WEIGHTS.date,
        detail: { key: "match.detail.dateUnknown", params: {} },
      });
    } else {
      breakdown.push({
        factor: "date",
        points: round(WEIGHTS.date * clamp01(group.avgDaysEarly / DATE_BUFFER_DAYS), 1),
        max: WEIGHTS.date,
        detail: { key: "match.detail.date", params: { days: group.avgDaysEarly } },
      });
    }

    // 5. participants
    breakdown.push({
      factor: "participants",
      points: round(
        Math.max(0, WEIGHTS.participants - PARTICIPANT_STEP * (group.participantCount - 1)),
        1
      ),
      max: WEIGHTS.participants,
      detail: { key: "match.detail.participants", params: { count: group.participantCount } },
    });

    group.breakdown = breakdown;
    group.score = round(breakdown.reduce((sum, entry) => sum + entry.points, 0), 1);
  });
}

// Complete matches first, then partial, then insufficient; inside a tier by score,
// then price, then fewer participants, then a stable id.
function compareGroups(side) {
  const tier = { complete: 0, partial: 1, insufficient: 2 };
  return (a, b) => {
    if (tier[a.status] !== tier[b.status]) {
      return tier[a.status] - tier[b.status];
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const ma = priceMetric(a, side);
    const mb = priceMetric(b, side);
    if (ma !== mb) {
      if (ma === null) return 1;
      if (mb === null) return -1;
      return side === "supply" ? ma - mb : mb - ma;
    }
    if (a.participantCount !== b.participantCount) {
      return a.participantCount - b.participantCount;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}
