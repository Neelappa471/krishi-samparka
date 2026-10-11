import test from "node:test";
import assert from "node:assert/strict";
import { searchFallbackCropPrices, FALLBACK_CROP_PRICE_COUNT } from "../data/fallbackCropPrices.js";
import {
  commodityNamesMatch,
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

test("local demo prices are used after API failure when no stored match exists", () => {
  const demoRows = searchFallbackCropPrices("  PINEAPPLE ", {
    state: "Karnataka",
    district: "Udupi",
    market: "Udupi",
  });
  assert.equal(FALLBACK_CROP_PRICE_COUNT, 21);
  assert.equal(demoRows.length, 1);
  assert.equal(demoRows[0].commodity, "Pineapple");
  assert.equal(demoRows[0].modal_price, 2200);
  assert.equal(demoRows[0].sourceType, "demo");

  const result = prioritizeMarketPriceResults({
    live: { rows: [], error: new Error("API timeout") },
    stored: { rows: [], error: null },
    demo: { rows: demoRows, error: null },
  });
  assert.equal(result.sourceType, "demo");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows, demoRows);
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
