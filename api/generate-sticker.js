export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shape, material, details } = req.body;

    if (!shape || !material) {
      return res.status(400).json({ error: 'Missing shape or material' });
    }

    const prompt = `
Sticker design for printing.

Shape: ${shape}
Material: ${material}
Details: ${details || 'No extra details'}

Style requirements:
- Flat design
- Print-ready
- Centered artwork
- No background bleed
- High contrast
- No text cut off
    `;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
      }),
    });

    const data = await response.json();

    if (!data.data || !data.data[0]?.url) {
      return res.status(500).json({ error: 'Invalid OpenAI response' });
    }

    res.status(200).json({
      imageUrl: data.data[0].url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Generation failed' });
  }
}
