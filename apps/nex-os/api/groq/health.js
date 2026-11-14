// api/health.js
// Permite que el frontend sepa si la función está viva y si GROQ_API_KEY está seteada,
// sin exponer la key en ningún momento.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: true,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
  });
}