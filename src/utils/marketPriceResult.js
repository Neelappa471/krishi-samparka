import { MANDI_COMMODITY_ALIASES, normalizeReferenceKey } from "../data/mandiReference.js";

/** Generic case-insensitive API commodity comparison. */
export function normalizeCommodityName(value) {
  return normalizeReferenceKey(value);
}

export function commodityNamesMatch(recordName, searchName) {
  return normalizeCommodityName(recordName) === normalizeCommodityName(searchName);
}

function searchNamesForCommodity(value) {
  const search = normalizeReferenceKey(value);
  const terms = new Set([search]);
  Object.entries(MANDI_COMMODITY_ALIASES).forEach(([commodity, aliases]) => {
    const names = [commodity, ...(aliases || [])].map(normalizeReferenceKey);
    if (names.includes(search)) names.forEach((name) => terms.add(name));
  });
  return terms;
}

function rowCommodityNames(row) {
  const values = [
    row.commodity, row.crop, row.crop_name, row.cropName, row.crop_en,
    row.crop_name_en, row.cropNameEn, row.commodity_en, row.commodityEn,
    row.crop_kn, row.cropKn, row.crop_name_kn, row.cropNameKn,
    row.commodity_kn, row.commodityKn, row.name,
  ];
  const aliases = row.aliases ?? row.crop_aliases ?? row.commodity_aliases;
  if (Array.isArray(aliases)) values.push(...aliases);
  else if (typeof aliases === "string") values.push(...aliases.split(/[;,|]/));
  return values.map(normalizeReferenceKey).filter(Boolean);
}

function firstDefined(row, keys, fallback = "") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

function asNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

/** Convert enabled Supabase fallback records into Market Prices table rows. */
export function mapFallbackCropPriceRows(
  records,
  commodity,
  { state = "", district = "", market = "" } = {}
) {
  const queryNames = searchNamesForCommodity(commodity);
  const stateTerm = normalizeReferenceKey(state);
  const districtTerm = normalizeReferenceKey(district);
  const marketTerm = normalizeReferenceKey(market);

  return (Array.isArray(records) ? records : []).filter((row) => {
    if (!row || row.enabled === false || row.is_enabled === false || row.isEnabled === false || row.active === false) return false;
    const names = rowCommodityNames(row);
    const cropMatches = names.some((name) => Array.from(queryNames).some((query) =>
      name === query || (query.length >= 3 && name.includes(query)) || (name.length >= 3 && query.includes(name))
    ));
    if (!cropMatches) return false;
    const rowState = normalizeReferenceKey(firstDefined(row, ["state", "state_name", "stateName"]));
    const rowDistrict = normalizeReferenceKey(firstDefined(row, ["district", "district_name", "districtName"]));
    const rowMarket = normalizeReferenceKey(firstDefined(row, ["market", "market_name", "marketName"]));
    if (stateTerm && rowState !== stateTerm) return false;
    if (districtTerm && !rowDistrict.includes(districtTerm)) return false;
    if (marketTerm && !rowMarket.includes(marketTerm)) return false;

    const min = asNumberOrNull(firstDefined(row, ["min_price", "min", "minimum_price", "minimum"] , null));
    const max = asNumberOrNull(firstDefined(row, ["max_price", "max", "maximum_price", "maximum"], null));
    const modal = asNumberOrNull(firstDefined(row, ["modal_price", "modal", "modal_rate", "modalPrice"], null));
    return modal !== null && modal > 0 && (min === null || min >= 0) &&
      (max === null || max >= 0) && (min === null || max === null || min <= max) &&
      (min === null || modal >= min) && (max === null || modal <= max);
  }).map((row) => ({
    id: row.id ?? [
      firstDefined(row, ["market", "market_name", "marketName"]),
      firstDefined(row, ["commodity", "crop", "crop_name", "cropName", "crop_name_en", "crop_en", "name"]),
      firstDefined(row, ["variety"]),
    ].join("|"),
    commodity: firstDefined(row, ["commodity", "crop", "crop_name", "cropName", "crop_name_en", "cropNameEn", "crop_en", "name"]),
    commodity_kn: firstDefined(row, ["commodity_kn", "commodityKn", "crop_kn", "cropKn", "crop_name_kn", "cropNameKn"]),
    state: firstDefined(row, ["state", "state_name", "stateName"]),
    district: firstDefined(row, ["district", "district_name", "districtName"]),
    district_kn: firstDefined(row, ["district_kn", "districtKn", "district_kannada"]),
    market: firstDefined(row, ["market", "market_name", "marketName"]),
    market_kn: firstDefined(row, ["market_kn", "marketKn", "market_kannada"]),
    variety: row.variety ?? "",
    variety_kn: row.variety_kn ?? "",
    min_price: asNumberOrNull(firstDefined(row, ["min_price", "min", "minimum_price", "minimum"], null)),
    max_price: asNumberOrNull(firstDefined(row, ["max_price", "max", "maximum_price", "maximum"], null)),
    modal_price: asNumberOrNull(firstDefined(row, ["modal_price", "modal", "modal_rate", "modalPrice"], null)),
    date: row.date ?? row.arrival_date ?? null,
    arrival_date: row.arrival_date ?? row.date ?? null,
    unit: firstDefined(row, ["unit", "price_unit", "priceUnit"]),
    source: row.source ?? "Supabase fallback reference/demo pricing",
    sourceType: "fallback-supabase",
  }));
}

/** Keep live API results ahead of stored and enabled Supabase fallback rows. */
export function prioritizeMarketPriceResults({ live, stored, fallback }) {
  if (live && !live.error && live.rows?.length) {
    return { rows: live.rows, error: null, sourceType: "live-api" };
  }
  if (stored && stored.rows?.length) {
    return { rows: stored.rows, error: null, sourceType: "supabase" };
  }
  if (fallback && fallback.rows?.length) {
    return { rows: fallback.rows, error: null, sourceType: "fallback-supabase" };
  }
  return {
    rows: [],
    error: stored?.error || fallback?.error || live?.error || null,
    sourceType: fallback?.error
      ? "fallback-supabase"
      : stored
      ? "supabase"
      : fallback
      ? "fallback-supabase"
      : live
      ? "live-api"
      : null,
  };
}
