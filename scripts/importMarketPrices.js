/**
 * Import AGMARKNET daily mandi prices from data.gov.in into Supabase `market_prices`.
 *
 * Requires (environment variables — never commit these):
 *   DATA_GOV_IN_API_KEY     — register at https://data.gov.in/user/register
 *   VITE_SUPABASE_URL       — or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — server-side only (Supabase Dashboard → Settings → API)
 *
 * Official resource (DMI / AGMARKNET):
 *   https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi
 *   Resource ID: 9ef84268-d588-465a-a308-a864a43d0070
 *
 * Usage (from krishisetu/):
 *   node scripts/importMarketPrices.js --state Karnataka --limit 5000
 *   node scripts/importMarketPrices.js --state Karnataka --district Udupi --commodity Mango
 *   node scripts/importMarketPrices.js --csv path/to/export.csv
 *
 * CSV mode: export from data.gov.in zip or AGMARKNET Excel export; expected headers (case-insensitive):
 *   state, district, market, commodity, variety, arrival_date (or date),
 *   min_price, max_price, modal_price, and optionally unit / commodity_uom
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const API_BASE = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
const SOURCE_LABEL = "Government of India / AGMARKNET (data.gov.in)";
const BATCH_SIZE = 200;

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv) {
  const out = {
    state: "",
    district: "",
    commodity: "",
    limit: 5000,
    offset: 0,
    csv: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--state") out.state = argv[++i] || "";
    else if (arg === "--district") out.district = argv[++i] || "";
    else if (arg === "--commodity") out.commodity = argv[++i] || "";
    else if (arg === "--limit") out.limit = Number(argv[++i]) || out.limit;
    else if (arg === "--offset") out.offset = Number(argv[++i]) || 0;
    else if (arg === "--csv") out.csv = argv[++i] || "";
  }
  return out;
}

function pickField(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return String(record[key]).trim();
    }
  }
  return "";
}

function parseDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapRecord(record) {
  const commodity = pickField(record, [
    "commodity",
    "Commodity",
    "COMMODITY",
  ]);
  const state = pickField(record, ["state", "State", "STATE"]);
  const district = pickField(record, ["district", "District", "DISTRICT"]);
  const market = pickField(record, ["market", "Market", "MARKET"]);
  const variety = pickField(record, ["variety", "Variety", "VARIETY"]);
  const dateRaw = pickField(record, [
    "arrival_date",
    "Arrival_Date",
    "date",
    "Date",
  ]);
  const date = parseDate(dateRaw);
  const unit = pickField(record, [
    "commodity_uom",
    "Commodity_Uom",
    "unit",
    "Unit",
  ]);

  if (!commodity || !state || !district || !market || !date) {
    return null;
  }

  return {
    commodity,
    variety: variety || "",
    state,
    district,
    market,
    min_price: parsePrice(
      pickField(record, ["min_price", "Min_Price", "min price"])
    ),
    max_price: parsePrice(
      pickField(record, ["max_price", "Max_Price", "max price"])
    ),
    modal_price: parsePrice(
      pickField(record, ["modal_price", "Modal_Price", "modal price"])
    ),
    date,
    unit: unit || null,
    source: SOURCE_LABEL,
  };
}

function recordMatchesFilters(row, filters) {
  if (filters.state && row.state.toLowerCase() !== filters.state.toLowerCase()) {
    return false;
  }
  if (
    filters.district &&
    !row.district.toLowerCase().includes(filters.district.toLowerCase())
  ) {
    return false;
  }
  if (
    filters.commodity &&
    !row.commodity.toLowerCase().includes(filters.commodity.toLowerCase())
  ) {
    return false;
  }
  return true;
}

async function fetchApiPage(apiKey, offset, limit) {
  const url = new URL(API_BASE);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.message || body?.error || res.statusText || "data.gov.in request failed";
    throw new Error(msg);
  }
  return body.records || [];
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function loadCsvRecords(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

async function upsertBatch(supabase, batch) {
  if (batch.length === 0) return;
  const { error } = await supabase.from("market_prices").upsert(batch, {
    onConflict: "commodity,variety,market,date",
  });
  if (error) {
    throw error;
  }
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv);

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL (or SUPABASE_URL) in environment."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let rawRecords = [];

  if (args.csv) {
    const csvPath = path.resolve(process.cwd(), args.csv);
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV not found: ${csvPath}`);
      process.exit(1);
    }
    console.log(`Reading CSV: ${csvPath}`);
    rawRecords = loadCsvRecords(csvPath);
  } else {
    const apiKey = process.env.DATA_GOV_IN_API_KEY || "";
    if (!apiKey) {
      console.error(
        "Set DATA_GOV_IN_API_KEY (register at https://data.gov.in) or use --csv with an official export."
      );
      process.exit(1);
    }

    console.log(
      `Fetching from data.gov.in (offset ${args.offset}, limit ${args.limit})…`
    );
    let fetched = 0;
    let offset = args.offset;
    const pageSize = Math.min(1000, args.limit);

    while (fetched < args.limit) {
      const page = await fetchApiPage(apiKey, offset, pageSize);
      if (page.length === 0) break;
      rawRecords.push(...page);
      fetched += page.length;
      offset += page.length;
      if (page.length < pageSize) break;
    }
  }

  const filters = {
    state: args.state,
    district: args.district,
    commodity: args.commodity,
  };

  const mapped = [];
  for (const rec of rawRecords) {
    const row = mapRecord(rec);
    if (!row) continue;
    if (!recordMatchesFilters(row, filters)) continue;
    mapped.push(row);
  }

  console.log(`Mapped ${mapped.length} rows after filters.`);

  let inserted = 0;
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const chunk = mapped.slice(i, i + BATCH_SIZE);
    await upsertBatch(supabase, chunk);
    inserted += chunk.length;
    console.log(`Upserted ${inserted} / ${mapped.length}`);
  }

  console.log("Import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
