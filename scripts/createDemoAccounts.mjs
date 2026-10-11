import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = resolve(process.cwd(), ".env.demo.local");
const DEMO_MARKER = "krishi_samparka_demo";
const USERS_PER_PAGE = 1000;

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      if (record.some((part) => part.trim() !== "")) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  record.push(field);
  if (record.some((part) => part.trim() !== "")) records.push(record);
  return records;
}

export function parseDemoUsersCsv(text) {
  const records = parseCsv(String(text).replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("CSV must include a header and at least one user row.");
  const headers = records[0].map((value) => value.trim().toLowerCase());
  const findColumn = (...names) => headers.findIndex((value) => names.includes(value));
  const roleIndex = findColumn("role", "account_type");
  const nameIndex = findColumn("name", "full_name");
  const emailIndex = findColumn("email");
  const passwordIndex = findColumn("password");
  const locationIndex = findColumn("location");
  if ([roleIndex, nameIndex, emailIndex, passwordIndex].some((index) => index < 0)) {
    throw new Error("CSV headers must include Role/account_type, Name/full_name, Email, and Password.");
  }

  const users = records.slice(1).map((row, index) => {
    const role = String(row[roleIndex] || "").trim().toLowerCase();
    const full_name = String(row[nameIndex] || "").trim();
    const email = String(row[emailIndex] || "").trim().toLowerCase();
    const password = String(row[passwordIndex] ?? "");
    const location = locationIndex >= 0 ? String(row[locationIndex] || "").trim() : "";
    if (role !== "farmer" && role !== "buyer") {
      throw new Error("Row " + (index + 2) + " has an invalid role; only farmer and buyer are allowed.");
    }
    if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password.trim()) {
      throw new Error("Row " + (index + 2) + " is missing a valid name, email, or password.");
    }
    return { email, password, full_name, account_type: role, location };
  });

  const emails = users.map((user) => user.email);
  if (new Set(emails).size !== emails.length) throw new Error("CSV contains duplicate email addresses.");
  return users;
}

async function readDemoEnvironment() {
  let fileText = "";
  try {
    fileText = await readFile(ENV_FILE, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Could not read .env.demo.local.");
  }
  const fileValues = {};
  fileText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) return;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fileValues[match[1]] = value;
  });
  const get = (key) => process.env[key] || fileValues[key] || "";
  return {
    supabaseUrl: get("SUPABASE_URL").replace(/\/$/, ""),
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY"),
    usersFile: get("DEMO_USERS_FILE"),
  };
}

async function fillLocations(users) {
  const missing = users.some((user) => !user.location);
  if (!missing) return users;
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Add a Location column to the CSV or run this utility in an interactive PowerShell terminal.");
  }

  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    for (const [index, user] of users.entries()) {
      if (!user.location) {
        user.location = (await terminal.question(
          "Location for account " + (index + 1) + " (" + user.full_name + ", " + user.account_type + "): "
        )).trim();
        if (!user.location) throw new Error("A location is required for every account.");
      }
    }
  } finally {
    terminal.close();
  }
  return users;
}

function accountMetadata(user) {
  return {
    full_name: user.full_name,
    account_type: user.account_type,
    location: user.location,
  };
}

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw Object.assign(new Error("Auth user lookup failed."), { stage: "Auth lookup", status: error.status });
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < USERS_PER_PAGE) return users;
  }
  throw new Error("Auth user lookup exceeded the safety pagination limit.");
}

function safeResultError(stage, error) {
  return { ok: false, stage, status: Number.isInteger(error?.status) ? error.status : null };
}

export async function syncDemoUsers(users, client) {
  const existingUsers = await listAllUsers(client);
  const results = [];

  for (const user of users) {
    let authUser = existingUsers.find((entry) => String(entry.email || "").toLowerCase() === user.email);
    let operation = "created";

    if (authUser) {
      if (authUser.app_metadata?.[DEMO_MARKER] !== true) {
        results.push({ ok: false, stage: "existing account is not managed by this utility", status: null });
        continue;
      }
      operation = "updated";
      const { data, error } = await client.auth.admin.updateUserById(authUser.id, {
        password: user.password,
        email_confirm: true,
        user_metadata: { ...(authUser.user_metadata || {}), ...accountMetadata(user) },
        app_metadata: { ...(authUser.app_metadata || {}), [DEMO_MARKER]: true },
      });
      if (error) {
        results.push(safeResultError("Auth update", error));
        continue;
      }
      authUser = data?.user;
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: accountMetadata(user),
        app_metadata: { [DEMO_MARKER]: true },
      });
      if (error) {
        results.push(safeResultError("Auth create", error));
        continue;
      }
      authUser = data?.user;
      if (authUser) existingUsers.push(authUser);
    }

    if (!authUser?.id) {
      results.push({ ok: false, stage: "Auth response did not include a user ID", status: null });
      continue;
    }

    const expectedProfile = {
      id: authUser.id,
      full_name: user.full_name,
      account_type: user.account_type,
      location: user.location,
    };
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .upsert(expectedProfile, { onConflict: "id" })
      .select("id, full_name, account_type, location")
      .single();
    if (profileError) {
      results.push(safeResultError("Profile upsert", profileError));
      continue;
    }

    const matches = profile && Object.entries(expectedProfile).every(([key, value]) => profile[key] === value);
    results.push(matches
      ? { ok: true, operation, account_type: user.account_type }
      : { ok: false, stage: "Profile verification did not match Auth user", status: null });
  }

  return results;
}

function parseArgs(args) {
  const options = { dryRun: false, csvFile: "" };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dry-run") options.dryRun = true;
    else if (args[i] === "--csv" && args[i + 1]) options.csvFile = args[++i];
    else throw new Error("Usage: npm run demo:accounts -- [--dry-run] [--csv <file>]");
  }
  return options;
}

async function main(args) {
  const options = parseArgs(args);
  const env = await readDemoEnvironment();
  const csvFile = options.csvFile || env.usersFile;
  if (!csvFile) throw new Error("Set DEMO_USERS_FILE in .env.demo.local or pass --csv <file>.");

  const parsedUsers = parseDemoUsersCsv(await readFile(resolve(csvFile), "utf8"));
  if (options.dryRun) {
    const missingLocations = parsedUsers.filter((user) => !user.location).length;
    console.log("Validated " + parsedUsers.length + " demo account rows. No Supabase requests were made.");
    if (missingLocations) {
      console.log(missingLocations + " location(s) must be entered when the account creation run starts.");
    }
    return;
  }
  const users = await fillLocations(parsedUsers);

  const missing = [];
  if (!env.supabaseUrl) missing.push("SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new Error("Set required server-only variable(s) in .env.demo.local: " + missing.join(", "));

  const client = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const results = await syncDemoUsers(users, client);
  let succeeded = 0;
  results.forEach((result, index) => {
    const label = "Account " + (index + 1) + " (" + users[index].account_type + ")";
    if (result.ok) {
      succeeded += 1;
      console.log(label + ": " + result.operation + "; profile linked and verified.");
    } else {
      const status = result.status ? " (HTTP " + result.status + ")" : "";
      console.log(label + ": failed at " + result.stage + status + ". Details and credentials suppressed.");
    }
  });
  console.log("Finished: " + succeeded + "/" + results.length + " account(s) succeeded.");
  if (succeeded !== results.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    console.error("Demo account utility stopped. Check configuration, CSV format, and network access; sensitive details are suppressed.");
    process.exitCode = 1;
  });
}
