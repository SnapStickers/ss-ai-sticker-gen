export default async function handler(req, res) {
  // =========================
  // CORS (required for Shopify)
  // =========================
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
    // =========================
    // ENV CHECK
    // =========================
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY",
        hint: "Set it in Vercel → Project Settings → Environment Variables (Production) and redeploy",
      });
    }

    const { shape, material, details } = req.body || {};

    if (!shape || !material) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["shape", "material"],
      });
    }

    // =========================
    // PROMPT (print-safe)
    // =========================
    const prompt = `
Create a clean, print-ready sticker design.

Sticker requirements:
- Shape: ${shape}
- Material: ${material}
- Style: flat, vector-style illustration
- High contrast, bold lines, sticker-friendly
- No mockups, no hands, no photos, no background scenes
- Centered composition
- White or transparent-style background

Design notes from customer:
${details || "No additional details provided."}

If text is included:
- Keep it short
- Large, readable lettering
- Print-safe spacing
`.trim();

    // =========================
    // OPENAI IMAGE GENERATION
    // =========================
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "OpenAI API error",
        status: response.status,
        details: result,
      });
    }

    // =========================
    // IMPORTANT FIX:
    // gpt-image-1 returns base64
    // =========================
    const base64Image = result?.data?.[0]?.b64_json;

    if (!base64Image) {
      return res.status(500).json({
        error: "No image returned from OpenAI",
        raw: result,
      });
    }

    // Shopify-friendly image
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      imageUrl, // 👈 your Shopify UI expects this
      prompt,
      meta: {
        shape,
        material,
      },
    });
  } catch (err) {
    console.error("Sticker generation error:", err);

    return res.status(500).json({
      error: "Server error",
      message: err?.message || String(err),
    });
  }
}
