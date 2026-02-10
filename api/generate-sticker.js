export default async function handler(req, res) {
  // --- CORS (Shopify needs this) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { shape, material, details } = req.body || {};
    if (!shape || !material) {
      return res.status(400).json({ error: "Missing shape or material" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel env vars" });
    }

    const prompt = `
Create a clean, print-ready sticker design (flat vector style).
Shape: ${shape}
Material: ${material}
Customer details: ${details || "No extra details"}

Rules:
- Flat vector / simple shapes, no photo-realism
- High contrast, readable text, minimal tiny details
- Keep safe margins; avoid thin hairline strokes
- Centered composition, looks good as a real sticker
`;

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
        // For GPT image models, you should use base64 output (b64_json),
        // since URL output is not supported.
      }),
    });

    const data = await response.json();

    // If OpenAI returns an error, forward it so you can see it in the browser.
    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        details: data,
      });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({
        error: "Invalid OpenAI response (missing b64_json)",
        details: data,
      });
    }

    const imageDataUrl = `data:image/png;base64,${b64}`;

    return res.status(200).json({
      imageDataUrl, // <— use this on the Shopify page
      meta: { shape, material },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
