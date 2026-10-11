/**
 * fetcher.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agmarknet 2.0 API Client: metadata loader and state-wise price extractor.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { AGMARKNET_HEADERS } = require("./config");
const { getSolvedCaptcha } = require("./captcha");

/**
 * Loads national district and market mapping metadata from Agmarknet.
 * @returns {Promise<{ marketToDistrict: Map<string, string>, districtNameById: Map<number, string> }>}
 */
async function loadFilterMetadata() {
  const filterUrl = "https://api.agmarknet.gov.in/v1/daily-price-arrival/filters";
  const resp = await axios.get(filterUrl, {
    headers: AGMARKNET_HEADERS,
    timeout: 30000,
  });

  const json = resp.data;
  if (!json?.data?.district_data || !json?.data?.market_data) {
    throw new Error("Invalid filter metadata response received from Agmarknet.");
  }

  const districtNameById = new Map();
  for (const d of json.data.district_data) {
    districtNameById.set(d.id, (d.district_name || "").trim());
  }

  // Key: `${state_id}_${market_name_lowercase}` -> district_name
  const marketToDistrict = new Map();
  for (const m of json.data.market_data) {
    if (m.mkt_name) {
      const key = `${m.state_id}_${m.mkt_name.trim().toLowerCase()}`;
      marketToDistrict.set(key, districtNameById.get(m.district_id) || "");
    }
  }

  return { marketToDistrict, districtNameById };
}

/**
 * Fetches all market prices for a single state and arrival date.
 * Solves CAPTCHA on demand with retries.
 * @param {{ id: number, name: string }} stateObj
 * @param {string} dateStr (YYYY-MM-DD)
 * @param {Map<string, string>} marketToDistrict
 * @param {import("@google/genai").GoogleGenAI} ai
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function fetchStatePrices(stateObj, dateStr, marketToDistrict, ai) {
  let json = null;
  let retries = 3;

  while (retries > 0) {
    try {
      const { captcha_key, captcha } = await getSolvedCaptcha(ai);
      const url = `https://api.agmarknet.gov.in/v1/prices-and-arrivals/commodity-wise/daily-report-state?date=${dateStr}&stateIds=${stateObj.id}&includeExcel=false&captcha=${encodeURIComponent(captcha)}&captcha_key=${encodeURIComponent(captcha_key)}`;

      const resp = await axios.get(url, {
        headers: AGMARKNET_HEADERS,
        timeout: 35000,
      });

      json = resp.data;
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.warn(`      ⚠️ Failed fetching ${stateObj.name} for ${dateStr}: ${err.message}`);
        return [];
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (!json || !json.markets) return [];

  const rows = [];

  for (const mkt of json.markets || []) {
    const rawMarketName = (mkt.marketName || "").trim();
    if (!rawMarketName) continue;

    const normMarket = rawMarketName.toLowerCase();
    const key = `${stateObj.id}_${normMarket}`;
    let district = marketToDistrict.get(key) || "";

    if (!district) {
      const stripped = normMarket.replace(/\(f&v\)/g, "").replace(/\bapmc\b/g, "").trim();
      district = marketToDistrict.get(`${stateObj.id}_${stripped}`) || stateObj.name;
    }

    for (const grp of mkt.commodityGroups || []) {
      for (const cmdt of grp.commodities || []) {
        const commodityName = (cmdt.commodityName || "").trim();
        if (!commodityName) continue;

        const varietyCounts = new Map();
        const sortedItems = [...(cmdt.data || [])].sort(
          (a, b) => (Number(b.arrivals) || 0) - (Number(a.arrivals) || 0)
        );

        for (const item of sortedItems) {
          const modalPrice = Math.round(Number(item.modalPrice)) || 0;
          const minPrice = Math.round(Number(item.minimumPrice)) || modalPrice;
          const maxPrice = Math.round(Number(item.maximumPrice)) || modalPrice;
          const variety = (item.variety || commodityName || "Standard").trim();

          const rawArrivals = Number(item.arrivals);
          const arrivals = !isNaN(rawArrivals) && rawArrivals >= 0 ? Math.round(rawArrivals * 100) / 100 : 0;
          const arrivalUnit = (item.unitOfArrivals || "Metric Tonnes").trim();

          if (modalPrice > 0) {
            const vCount = (varietyCounts.get(variety) || 0) + 1;
            varietyCounts.set(variety, vCount);

            let grade = (item.grade || "").trim();
            if (!grade) {
              grade = vCount === 1 ? "" : `Lot ${vCount}`;
            }

            rows.push({
              state: stateObj.name,
              district,
              market_name: rawMarketName,
              commodity: commodityName,
              variety,
              grade,
              min_price: minPrice,
              max_price: maxPrice,
              modal_price: modalPrice,
              arrival_date: dateStr,
              arrivals,
              arrival_unit: arrivalUnit,
            });
          }
        }
      }
    }
  }

  return rows;
}

module.exports = {
  loadFilterMetadata,
  fetchStatePrices,
};
