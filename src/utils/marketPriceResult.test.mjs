import test from "node:test";
import assert from "node:assert/strict";
import {
  commodityNamesMatch,
  mapFallbackCropPriceRows,
  prioritizeMarketPriceResults,
} from "./marketPriceResult.js";

test("commodity comparisons trim whitespace and ignore letter case", () => {
  for (const name of ["Pineapple", "Black pepper", "Banana", "Cocoa", "Jasmine flower"]) {
    assert.equal(commodityNamesMatch("  " + name.toUpperCase() + " ", name.toLowerCase()), true);
  }
  assert.equal(commodityNamesMatch("Cocoa", "Coconut"), false);
});

test("matching live API rows take priority over stored records", () => {
  const liveRows = [{ id: "api-record" }];
  const storedRows = [{ id: "stored-record" }];
  assert.deepEqual(
    prioritizeMarketPriceResults({
      live: { rows: liveRows, error: null },
      stored: { rows: storedRows, error: null },
    }),
    { rows: liveRows, error: null, sourceType: "live-api" }
  );
});

test("stored records are returned when the API has no matches or errors", () => {
  const storedRows = [{ id: "stored-record" }];
  assert.deepEqual(
    prioritizeMarketPriceResults({
      live: { rows: [], error: null },
      stored: { rows: storedRows, error: null },
    }),
    { rows: storedRows, error: null, sourceType: "supabase" }
  );
  assert.deepEqual(
    prioritizeMarketPriceResults({
      live: { rows: [], error: new Error("unavailable") },
      stored: { rows: storedRows, error: null },
    }),
    { rows: storedRows, error: null, sourceType: "supabase" }
  );
});

test("enabled Supabase fallback rows map into UI shape and follow API/stored results", () => {
  const fallbackRows = mapFallbackCropPriceRows([
    {
      id: "fallback-1",
      crop: "Coconut",
      crop_kn: "ತೆಂಗಿನಕಾಯಿ",
      aliases: ["tengina kayi"],
      state: "Karnataka",
      district: "Udupi",
      market: "Udupi",
      variety: "Local",
      min_price: "1800",
      max_price: "2400",
      modal_price: "2100",
      unit: "quintal",
      enabled: true,
    },
    { crop: "Coconut", state: "Karnataka", district: "Udupi", market: "Udupi", modal_price: 2100, enabled: false },
    { crop: "Coconut", state: "Karnataka", district: "Dakshina Kannada", market: "Mangaluru", modal_price: 2100, enabled: true },
  ], "ತೆಂಗು", { state: "Karnataka", district: "Udupi", market: "Udupi" });
  assert.equal(fallbackRows.length, 1);
  assert.equal(fallbackRows[0].commodity, "Coconut");
  assert.equal(fallbackRows[0].commodity_kn, "ತೆಂಗಿನಕಾಯಿ");
  assert.equal(fallbackRows[0].modal_price, 2100);
  assert.equal(fallbackRows[0].sourceType, "fallback-supabase");

  const result = prioritizeMarketPriceResults({
    live: { rows: [], error: new Error("API timeout") },
    stored: { rows: [], error: null },
    fallback: { rows: fallbackRows, error: null },
  });
  assert.equal(result.sourceType, "fallback-supabase");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows, fallbackRows);
});

test("a matching stored fallback query error remains an ordinary result error", () => {
  const error = new Error("fallback read denied");
  assert.deepEqual(
    prioritizeMarketPriceResults({
      live: { rows: [], error: new Error("unavailable") },
      stored: { rows: [], error: null },
      fallback: { rows: [], error },
    }),
    { rows: [], error, sourceType: "fallback-supabase" }
  );
});

test("empty results stay empty and preserve a stored-query error", () => {
  const error = new Error("stored query failed");
  assert.deepEqual(
    prioritizeMarketPriceResults({
      live: { rows: [], error: null },
      stored: { rows: [], error },
    }),
    { rows: [], error, sourceType: "supabase" }
  );
});
