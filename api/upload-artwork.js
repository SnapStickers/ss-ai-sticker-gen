import { put } from "@vercel/blob";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    const blob = await put(
      `artwork/${Date.now()}.png`,
      buffer,
      {
        access: "public",
        contentType: "image/png",
        addRandomSuffix: true
      }
    );

    return res.status(200).json({
      success: true,
      url: blob.url
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
