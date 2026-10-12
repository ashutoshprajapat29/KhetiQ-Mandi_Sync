/**
 * config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * State mappings and configuration constants for Agmarknet 2.0 crawling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Priority Agricultural & Strategic States (Primary automated sync target)
 * Includes major northern, central, southern, and eastern agricultural producers.
 */
const CORE_NORTHERN_STATES = [
  { id: 19, name: "Madhya Pradesh" },
  { id: 34, name: "Uttar Pradesh" },
  { id: 29, name: "Rajasthan" },
  { id: 28, name: "Punjab" },
  { id: 12, name: "Haryana" },
  { id: 5,  name: "Bihar" },
  { id: 11, name: "Gujarat" },
  { id: 20, name: "Maharashtra" },
  { id: 25, name: "Delhi" },
  { id: 13, name: "Himachal Pradesh" },
  { id: 6,  name: "Chandigarh" },
  { id: 35, name: "Uttarakhand" },
  { id: 31, name: "Tamil Nadu" },
  { id: 16, name: "Karnataka" },
  { id: 2,  name: "Andhra Pradesh" },
  { id: 32, name: "Telangana" },
  { id: 36, name: "West Bengal" },
  { id: 7,  name: "Chattisgarh" },
  { id: 26, name: "Odisha" },
  { id: 17, name: "Kerala" },
];

/**
 * Complete Agmarknet 2.0 State ID mapping for all 33 states & UTs
 */
const ALL_AGMARKNET_STATES = [
  { id: 19, name: "Madhya Pradesh" },
  { id: 20, name: "Maharashtra" },
  { id: 34, name: "Uttar Pradesh" },
  { id: 29, name: "Rajasthan" },
  { id: 11, name: "Gujarat" },
  { id: 28, name: "Punjab" },
  { id: 12, name: "Haryana" },
  { id: 5,  name: "Bihar" },
  { id: 16, name: "Karnataka" },
  { id: 31, name: "Tamil Nadu" },
  { id: 2,  name: "Andhra Pradesh" },
  { id: 32, name: "Telangana" },
  { id: 36, name: "West Bengal" },
  { id: 7,  name: "Chattisgarh" },
  { id: 26, name: "Odisha" },
  { id: 17, name: "Kerala" },
  { id: 13, name: "Himachal Pradesh" },
  { id: 35, name: "Uttarakhand" },
  { id: 4,  name: "Assam" },
  { id: 15, name: "Jharkhand" },
  { id: 25, name: "Delhi" },
  { id: 6,  name: "Chandigarh" },
  { id: 14, name: "Jammu and Kashmir" },
  { id: 10, name: "Goa" },
  { id: 33, name: "Tripura" },
  { id: 21, name: "Manipur" },
  { id: 22, name: "Meghalaya" },
  { id: 24, name: "Nagaland" },
  { id: 23, name: "Mizoram" },
  { id: 3,  name: "Arunachal Pradesh" },
  { id: 30, name: "Sikkim" },
  { id: 27, name: "Puducherry" },
  { id: 1,  name: "Andaman and Nicobar" },
];

const AGMARKNET_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://agmarknet.gov.in",
  "Referer": "https://agmarknet.gov.in/",
};

module.exports = {
  CORE_NORTHERN_STATES,
  PRIORITY_AGRICULTURAL_STATES: CORE_NORTHERN_STATES,
  ALL_AGMARKNET_STATES,
  AGMARKNET_HEADERS,
};
