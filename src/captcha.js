/**
 * captcha.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hybrid CAPTCHA solver: Instant Plaintext Audio API with Gemini Vision Fallback.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { AGMARKNET_HEADERS } = require("./config");

/**
 * Fetches a fresh CAPTCHA challenge from Agmarknet and solves it.
 * Primary: Instant plaintext lookup via accessibility endpoint (0 AI tokens, ~150ms).
 * Fallback: Google Gemini 3.1 Flash Lite multimodal vision inference.
 * @param {import("@google/genai").GoogleGenAI} [ai]
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

  // 1. Fast Path: Instant plaintext extraction via accessibility endpoint (0 AI tokens, ~150ms)
  try {
    const audioResp = await axios.get(
      `https://api.agmarknet.gov.in/v1/captcha/getaudio/${captcha_key}`,
      {
        headers: AGMARKNET_HEADERS,
        timeout: 10000,
      }
    );
    const audioText = (audioResp.data?.audio_text || "").trim();
    if (audioText && audioText.length >= 4 && audioText.length <= 8) {
      return { captcha_key, captcha: audioText };
    }
  } catch (_audioErr) {
    // If audio endpoint fails, gracefully fall through to Gemini Vision
  }

  // 2. Fallback Path: Gemini Vision Inference
  if (!ai) {
    throw new Error("Agmarknet audio captcha unavailable and Gemini AI instance is not configured for fallback.");
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
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  console.log("Testing Agmarknet CAPTCHA generation with hybrid solver...");
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
