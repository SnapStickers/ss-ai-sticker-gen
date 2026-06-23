import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

    if (!buffer.length) {
      return res.status(400).json({ error: "No image data received" });
    }

    const blob = await put(`artwork/${Date.now()}-sticker.png`, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
    });
  } catch (error) {
    console.error("Upload artwork error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Upload failed",
    });
  }
}
