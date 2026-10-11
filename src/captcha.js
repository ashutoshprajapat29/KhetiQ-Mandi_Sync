/**
 * captcha.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-powered CAPTCHA solver using Google Gemini 3.1 Flash Lite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { AGMARKNET_HEADERS } = require("./config");

/**
 * Fetches a fresh CAPTCHA challenge from Agmarknet and solves it via Gemini Vision.
 * @param {import("@google/genai").GoogleGenAI} ai
 * @returns {Promise<{ captcha_key: string, captcha: string }>}
 */
async function getSolvedCaptcha(ai) {
  const capResp = await axios.post(
    "https://api.agmarknet.gov.in/v1/captcha/generator",
    {},
    {
      headers: {
        ...AGMARKNET_HEADERS,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  const { captcha_key, captcha_image } = capResp.data || {};
  if (!captcha_key || !captcha_image) {
    throw new Error("Invalid response received from Agmarknet captcha generator.");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Extract only the 6 alphanumeric characters shown in this captcha image. Respond with ONLY the exact 6 characters without any spaces, quotes, or punctuation.",
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: captcha_image,
            },
          },
        ],
      },
    ],
  });

  const rawText = (response.text || "").trim();
  const captcha = rawText.replace(/[^a-zA-Z0-9]/g, "");

  if (captcha.length < 4 || captcha.length > 8) {
    throw new Error(`Captcha solver returned unexpected string length: "${rawText}"`);
  }

  return { captcha_key, captcha };
}

// Standalone verification runner: npm run test:captcha
if (require.main === module) {
  const { GoogleGenAI } = require("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY environment variable is required.");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  console.log("Testing Agmarknet CAPTCHA generation and solving with gemini-3.1-flash-lite...");
  getSolvedCaptcha(ai)
    .then(({ captcha_key, captcha }) => {
      console.log(`✅ Success! Key: ${captcha_key} | Solved: "${captcha}"`);
    })
    .catch((err) => {
      console.error("❌ Failed:", err.message);
      process.exit(1);
    });
}

module.exports = {
  getSolvedCaptcha,
};
