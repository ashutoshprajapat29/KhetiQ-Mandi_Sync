/**
 * index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Main Autonomous Sync Runner for Agmarknet 2.0 -> Supabase.
 * 
 * CLI Usage:
 *   node src/index.js [startDate] [endDate] [statesFilter]
 * 
 * Examples:
 *   node src/index.js                               # Sync today's core northern states
 *   node src/index.js 2026-10-10 2026-10-11         # Sync specific date range
 *   node src/index.js 2026-10-11 2026-10-11 "all"   # Sync all 33 states
 *   node src/index.js 2026-10-11 2026-10-11 "punjab,haryana"
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI } = require("@google/genai");
const { CORE_NORTHERN_STATES, ALL_AGMARKNET_STATES } = require("./config");
const { loadFilterMetadata, fetchStatePrices } = require("./fetcher");

// ─── 1. Credentials Validation ───────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Fatal: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured as environment variables.");
  process.exit(1);
}

if (!geminiKey) {
  console.error("❌ Fatal: GEMINI_API_KEY must be configured as an environment variable.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const ai = new GoogleGenAI({ apiKey: geminiKey });

// ─── 2. Helpers ──────────────────────────────────────────────────────────────
function getDateList(startStr, endStr) {
  const dates = [];
  let curr = new Date(startStr);
  const end = new Date(endStr);
  while (curr <= end) {
    const yyyy = curr.getUTCFullYear();
    const mm = String(curr.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(curr.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

// ─── 3. Main Orchestrator ────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  KHETIQ — AGMARKNET 2.0 AUTONOMOUS MANDI SYNC ENGINE");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Determine target dates (default: today in IST, or yesterday if delayed past midnight)
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const istHour = istNow.getUTCHours();
  const istMinute = istNow.getUTCMinutes();
  const istTimeString = `${String(istHour).padStart(2, "0")}:${String(istMinute).padStart(2, "0")} IST`;

  let defaultDate = istNow.toISOString().split("T")[0];
  let isEarlyMorningRollover = false;

  // If executing between 00:00 and 06:00 AM IST (late-night/EOD waves delayed past midnight by GitHub queues),
  // target yesterday's date because mandis are closed and today's arrivals have not begun yet.
  if (istHour < 6) {
    const yesterdayIST = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    defaultDate = yesterdayIST.toISOString().split("T")[0];
    isEarlyMorningRollover = true;
  }

  const rawStart = (process.argv[2] || "").trim();
  const rawEnd = (process.argv[3] || "").trim();
  const rawState = (process.argv[4] || "").trim();

  const startDate = rawStart || defaultDate;
  const endDate = rawEnd || startDate;
  const stateArg = rawState || null;

  if (isEarlyMorningRollover && !rawStart) {
    console.log(`🌙 Early Morning Execution detected (${istTimeString}): Defaulting target date to yesterday (${defaultDate}) for complete EOD closing rates.\n`);
  } else {
    console.log(`☀️  Execution Time: ${istTimeString} | Base Date: ${defaultDate}\n`);
  }

  const dates = getDateList(startDate, endDate);
  console.log(`📅 Target Dates: ${startDate} to ${endDate} (${dates.length} day(s))`);

  // Determine target states
  let targetStates = CORE_NORTHERN_STATES;
  if (stateArg) {
    if (stateArg.toLowerCase() === "all") {
      targetStates = ALL_AGMARKNET_STATES;
    } else {
      const filters = stateArg.split(",").map((s) => s.trim().toLowerCase());
      targetStates = ALL_AGMARKNET_STATES.filter((s) =>
        filters.some((f) => s.name.toLowerCase().includes(f) || String(s.id) === f)
      );
    }
  }
  console.log(`🏛️  Target States (${targetStates.length}): ${targetStates.map((s) => s.name).join(", ")}\n`);

  console.log("📍 Initializing Agmarknet filter metadata...");
  const { marketToDistrict } = await loadFilterMetadata();
  console.log("   ✅ Metadata ready.\n");

  let grandTotalFetched = 0;
  let grandTotalUpserted = 0;
  let grandTotalErrors = 0;

  for (const dateStr of dates) {
    console.log(`─────────────── DATE: ${dateStr} ───────────────`);

    for (const stateObj of targetStates) {
      process.stdout.write(`   📡 [${stateObj.name.padEnd(16)}] Fetching... `);
      const stateRows = await fetchStatePrices(stateObj, dateStr, marketToDistrict, ai);
      grandTotalFetched += stateRows.length;

      if (stateRows.length === 0) {
        console.log(`0 rows.`);
        continue;
      }

      // Deduplicate rows for this state & date before upserting
      const dedupMap = new Map();
      for (const r of stateRows) {
        const key = `${r.state}|${r.district}|${r.market_name}|${r.commodity}|${r.variety}|${r.grade}|${r.arrival_date}`;
        const existing = dedupMap.get(key);
        if (existing) {
          existing.arrivals = Math.round(((existing.arrivals || 0) + (r.arrivals || 0)) * 100) / 100;
          if (r.min_price > 0) {
            existing.min_price = existing.min_price > 0 ? Math.min(existing.min_price, r.min_price) : r.min_price;
          }
          if (r.max_price > 0) {
            existing.max_price = Math.max(existing.max_price, r.max_price);
          }
        } else {
          dedupMap.set(key, { ...r });
        }
      }
      const uniqueRows = Array.from(dedupMap.values());

      // Upsert in batches of 500
      let stateUpserted = 0;
      for (let i = 0; i < uniqueRows.length; i += 500) {
        const batch = uniqueRows.slice(i, i + 500);
        const { error } = await supabase.from("mandi_prices").upsert(batch, {
          onConflict: "state,district,market_name,commodity,variety,grade,arrival_date",
        });

        if (error) {
          console.warn(`\n      ❌ Upsert error: ${error.message}`);
          grandTotalErrors++;
        } else {
          stateUpserted += batch.length;
          grandTotalUpserted += batch.length;
        }
      }

      console.log(`Found ${stateRows.length} rows -> Upserted ${stateUpserted} rows.`);
      // Polite rate limit delay between states
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SYNC EXECUTION COMPLETED");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ⏱️  Duration:       ${durationSec}s`);
  console.log(`  📊 Rows Fetched:   ${grandTotalFetched}`);
  console.log(`  ✅ Rows Upserted:  ${grandTotalUpserted}`);
  console.log(`  ❌ Errors:         ${grandTotalErrors}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (grandTotalErrors > 0 && grandTotalUpserted === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
