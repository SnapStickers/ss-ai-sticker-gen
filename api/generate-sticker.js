import OpenAI from "openai";

/**
 * SNAP STICKERS — Vercel API route
 * File: /api/generate-sticker.js
 *
 * MVP behavior:
 * - Accepts the frontend payload we designed earlier
 * - Validates all user-entered fields at <= 100 words
 * - Builds a much richer hidden sticker-generation prompt
 * - Calls OpenAI image generation
 * - Returns a base64 PNG as a data URL for immediate display/download
 *
 * Before deploying:
 * 1) npm install openai
 * 2) Add OPENAI_API_KEY in Vercel env vars
 *
 * Notes:
 * - This version does NOT save images yet
 * - This version does NOT enforce the 3-generation account limit yet
 * - This version assumes your Shopify frontend already handles "must be logged in"
 */

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_WORDS = 100;
const ALLOWED_METHODS = new Set(["POST"]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function countWords(value) {
  const text = cleanString(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function assertWordLimit(label, value) {
  if (!value) return;
  const words = countWords(value);
  if (words > MAX_WORDS) {
    const err = new Error(`${label} must be 100 words or less.`);
    err.statusCode = 400;
    throw err;
  }
}

function requireNonEmpty(label, value) {
  if (!cleanString(value)) {
    const err = new Error(`${label} is required.`);
    err.statusCode = 400;
    throw err;
  }
}

function sanitizeAnswers(rawAnswers = {}) {
  const answers = {
    useType: cleanString(rawAnswers.useType),
    stickerFor: cleanString(rawAnswers.stickerFor),
    designDescription: cleanString(rawAnswers.designDescription),
    styleVibe: cleanString(rawAnswers.styleVibe),
    shape: cleanString(rawAnswers.shape),
    material: cleanString(rawAnswers.material),
    colorDirection: cleanString(rawAnswers.colorDirection),
    textChoice: cleanString(rawAnswers.textChoice),
    headerText: cleanString(rawAnswers.headerText),
    subText: cleanString(rawAnswers.subText),
    avoid: cleanString(rawAnswers.avoid),
  };

  requireNonEmpty("useType", answers.useType);
  requireNonEmpty("stickerFor", answers.stickerFor);
  requireNonEmpty("designDescription", answers.designDescription);

  assertWordLimit("What the sticker is for", answers.stickerFor);
  assertWordLimit("Design description", answers.designDescription);
  assertWordLimit("Style / vibe", answers.styleVibe);
  assertWordLimit("Shape", answers.shape);
  assertWordLimit("Material", answers.material);
  assertWordLimit("Color direction", answers.colorDirection);
  assertWordLimit("Header text", answers.headerText);
  assertWordLimit("Sub text", answers.subText);
  assertWordLimit("Avoid field", answers.avoid);

  return answers;
}

function inferTextMode(answers) {
  if (answers.textChoice === "No text") return "no_text";
  if (answers.headerText || answers.subText) return "has_text";
  return "unspecified";
}

function materialGuidance(material) {
  const m = material.toLowerCase();

  if (m.includes("clear")) {
    return [
      "Design for clear material.",
      "Do not rely on a white background fill.",
      "Use strong silhouette separation so the art still reads on transparent material.",
      "Avoid pale outer edges that disappear against glass or light surfaces.",
    ].join(" ");
  }

  if (m.includes("holographic")) {
    return [
      "Design for holographic material.",
      "Favor bold shapes and strong contrast so the reflective material can enhance the art.",
      "Do not depend on subtle micro-details for the main read.",
    ].join(" ");
  }

  if (m.includes("glitter")) {
    return [
      "Design for glitter material.",
      "Use larger readable graphic zones and strong contour separation.",
      "Do not rely on tiny details for the main idea.",
    ].join(" ");
  }

  if (m.includes("kraft")) {
    return [
      "Design for kraft paper material.",
      "Favor earthy palettes, clean shapes, and readable contrast that would still work on a warm natural base.",
    ].join(" ");
  }

  if (m.includes("metallic")) {
    return [
      "Design for metallic material.",
      "Use bold composition and clear edges so reflective surfaces complement rather than overpower the design.",
    ].join(" ");
  }

  return [
    "Design for standard printable sticker material.",
    "Prioritize clear readability, crisp edges, and print-friendly contrast.",
  ].join(" ");
}

function shapeGuidance(shape) {
  const s = shape.toLowerCase();

  if (s.includes("die")) {
    return [
      "The composition should feel ideal for a die cut sticker.",
      "Create one strong central silhouette with a clean outer contour.",
      "Avoid detached floating bits that would make cutting awkward.",
    ].join(" ");
  }

  if (s.includes("circle")) {
    return [
      "Compose the design to fit naturally within a circular sticker.",
      "Keep important elements centered away from the edges.",
    ].join(" ");
  }

  if (s.includes("square")) {
    return [
      "Compose the design to sit comfortably in a square format with balanced spacing.",
    ].join(" ");
  }

  if (s.includes("rectangle")) {
    return [
      "Compose the design to fit a rectangular sticker with strong horizontal balance.",
    ].join(" ");
  }

  if (s.includes("oval")) {
    return [
      "Compose the design to fit an oval sticker with a soft central focus.",
    ].join(" ");
  }

  if (s.includes("rounded")) {
    return [
      "Compose the design for a rounded-corner sticker with safe margins near the edges.",
    ].join(" ");
  }

  return "Compose the design so it adapts cleanly to the selected sticker shape.";
}

function colorGuidance(colorDirection) {
  if (!colorDirection) {
    return "Choose a color palette that supports the concept and stays print-friendly.";
  }

  const c = colorDirection.toLowerCase();

  if (c.includes("surprise")) {
    return "Choose an excellent color palette that best fits the concept, mood, and print readability.";
  }

  if (c.includes("brand")) {
    return "Use a polished brand-appropriate color approach with controlled contrast and clean readability.";
  }

  return `Follow this color direction closely: ${colorDirection}. Keep the palette cohesive and print-friendly.`;
}

function textGuidance(answers) {
  const mode = inferTextMode(answers);

  if (mode === "no_text") {
    return [
      "Do not include any text in the image.",
      "Make the design communicate visually without lettering.",
    ].join(" ");
  }

  if (mode === "has_text") {
    const lines = [
      "Any requested text must be rendered clearly and legibly.",
      "Use strong readable typography appropriate for sticker printing.",
      "Do not stylize the text so heavily that it becomes hard to read.",
      "Do not invent replacement wording.",
      "Use the exact provided text where requested.",
    ];

    if (answers.headerText) {
      lines.push(`Primary text to include exactly: "${answers.headerText}".`);
    }

    if (answers.subText) {
      lines.push(`Secondary text to include exactly: "${answers.subText}".`);
    }

    return lines.join(" ");
  }

  return [
    "No exact text was supplied.",
    "Favor a graphic-first design.",
    "Do not add random words, logos, labels, or placeholder text.",
  ].join(" ");
}

function useTypeGuidance(useType, stickerFor) {
  const u = useType.toLowerCase();

  if (u.includes("business")) {
    return [
      "This is for business use.",
      "The design should feel commercially usable, polished, and intentional.",
      `Business context: ${stickerFor}.`,
    ].join(" ");
  }

  if (u.includes("personal")) {
    return [
      "This is for personal use.",
      "The design can feel more expressive, sentimental, playful, or personality-driven as appropriate.",
      `Personal context: ${stickerFor}.`,
    ].join(" ");
  }

  return `Context of use: ${stickerFor}.`;
}

function buildStickerPrompt(answers) {
  const sections = [];

  sections.push(
    [
      "Create a high-quality flat sticker design as standalone printable artwork.",
      "This should be a single finished sticker image asset, not a product mockup, not a scene, not a photo of a sticker on a surface.",
      "No table, hands, wall, packaging, laptop, bottle, shadows from a room, or environmental background.",
      "The output should look like a clean sticker graphic that can be downloaded and printed directly.",
    ].join(" ")
  );

  sections.push(
    [
      useTypeGuidance(answers.useType, answers.stickerFor),
      `Main purpose of the sticker: ${answers.stickerFor}.`,
      `Core design description from the user: ${answers.designDescription}.`,
    ].join(" ")
  );

  if (answers.styleVibe) {
    sections.push(`Overall style or vibe: ${answers.styleVibe}. Follow this closely.`);
  }

  if (answers.shape) {
    sections.push(`Sticker shape target: ${answers.shape}. ${shapeGuidance(answers.shape)}`);
  }

  if (answers.material) {
    sections.push(`Material / finish target: ${answers.material}. ${materialGuidance(answers.material)}`);
  }

  if (answers.colorDirection) {
    sections.push(colorGuidance(answers.colorDirection));
  }

  sections.push(textGuidance(answers));

  if (answers.avoid) {
    sections.push(
      `Avoid these elements or treatments: ${answers.avoid}. Follow this strictly unless it conflicts with safe rendering.`
    );
  }

  sections.push(
    [
      "Print-readiness requirements:",
      "clean edges, strong silhouette, clear focal hierarchy, balanced spacing, crisp forms, readable contrast, no muddy clutter, no tiny illegible details as the primary focal point.",
      "Favor an art style that reproduces well as sticker printing.",
      "Keep fine detail under control so the sticker remains readable at practical print sizes.",
    ].join(" ")
  );

  sections.push(
    [
      "Composition requirements:",
      "single centered composition, transparent background, no extra scene, no decorative background pattern unless it is an intentional integrated part of the sticker art itself.",
      "Keep the artwork contained and visually complete.",
      "No mockup border unless naturally needed as part of the sticker design language.",
    ].join(" ")
  );

  sections.push(
    [
      "Rendering goals:",
      "high instruction adherence, attractive professional finish, sticker-friendly graphic clarity, clean separation between major elements, and typography that is readable if text is requested.",
    ].join(" ")
  );

  return sections.join("\n\n");
}

function extractImageBase64(result) {
  const item = result?.data?.[0];
  if (!item) return null;

  if (item.b64_json) return item.b64_json;
  return null;
}

export default async function handler(req, res) {
  try {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Method not allowed." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return json(res, 500, { error: "Server is missing OPENAI_API_KEY." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const answers = sanitizeAnswers(body.answers || {});
    const finalPrompt = buildStickerPrompt(answers);

    // TODO later:
    // - verify Shopify customer session on the server
    // - enforce 3 generations per account
    // - save prompt + image record to a database
    // - save image to blob/cloud storage

    const result = await client.images.generate({
      model: "gpt-image-1.5",
      prompt: finalPrompt,
      size: "1024x1024",
      quality: "high",
      background: "transparent",
      output_format: "png",
    });

    const imageBase64 = extractImageBase64(result);

    if (!imageBase64) {
      return json(res, 502, {
        error: "OpenAI returned no image data.",
        debug: result ? Object.keys(result) : null,
      });
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`;

    return json(res, 200, {
      ok: true,
      imageUrl: dataUrl,
      mimeType: "image/png",
      finalPrompt,
      generationId: null,
      generationsRemaining: null,
      promptVersion: "backend-sticker-mvp-v1",
    });
  } catch (error) {
    console.error("generate-sticker error:", error);

    const statusCode = error?.statusCode || error?.status || 500;
    return json(res, statusCode, {
      ok: false,
      error: error?.message || "Something went wrong while generating the sticker.",
    });
  }
}
