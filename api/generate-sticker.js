export default async function handler(req, res) {
  // ---- CORS (required for Shopify/browser) ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---- Validate env ----
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY on server",
        hint: "Set it in Vercel Project → Settings → Environment Variables (Production) then redeploy.",
      });
    }

    const { shape, material, details } = req.body || {};

    if (!shape || !material) {
      return res.status(400).json({ error: "Missing shape or material" });
    }

    // ---- Prompt (keep it simple for now) ----
    const prompt = `
Create a print-ready sticker design (flat vector-like look, clean lines, high contrast).
Shape: ${shape}
Material: ${material}
Customer details: ${details || "No extra details"}

Rules:
- Centered design, no mockups, no photos of hands, no background scene.
- Solid background or transparent-feeling simple background.
- Bold, readable, sticker-friendly composition.
- If text is requested, keep it short and legible.
`.trim();

    // ---- OpenAI image generation ----
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        error: "OpenAI request failed",
        status: r.status,
        openai: data,
      });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({
        error: "No image returned from OpenAI",
        openai: data,
      });
    }

    const imageUrl = `data:image/png;base64,${b64}`;

    return res.status(200).json({
      imageUrl,     // <-- IMPORTANT: your Shopify UI is looking for this
      prompt,
      meta: { shape, material },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: String(err?.message || err),
    });
  }
}
