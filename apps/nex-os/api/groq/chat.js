// api/chat.js
// Vercel Serverless Function — corre por request, no es un servidor persistente.
// La GROQ_API_KEY se configura en Vercel: Project → Settings → Environment Variables.
//
// Además del chat plano (NEX AI en Nex Code), este endpoint sirve el tool
// calling de "Nex Assistant" cuando el body trae `useTools: true`. Vive acá
// en vez de en su propio archivo /api/groq/assistant.js para no sumar una
// función serverless más — Vercel Hobby limita a 12 por deployment y ya
// estamos en el techo con las de Groq, Spotify, YouTube, etc.

// Tools de Nex Assistant — solo se le mandan a Groq si el caller pide
// useTools:true, así el chat plano (Nex Code) nunca dispara tool_calls
// inesperados.
const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Abre o enfoca una aplicación de NEX OS por su appId exacto (ver la lista de apps disponibles en el mensaje de sistema).',
      parameters: {
        type: 'object',
        properties: { appId: { type: 'string', description: 'appId exacto de la app a abrir.' } },
        required: ['appId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_app',
      description: 'Cierra la ventana de una app que esté abierta, por su appId.',
      parameters: {
        type: 'object',
        properties: { appId: { type: 'string' } },
        required: ['appId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'minimize_all_windows',
      description: 'Minimiza todas las ventanas abiertas (mostrar escritorio).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Crea un archivo de texto en Documentos y lo abre en el Bloc de notas.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Nombre del archivo sin extensión, ej: "Ideas". Opcional.' },
          content: { type: 'string', description: 'Contenido de la nota.' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_neon_theme',
      description: 'Cambia el tema neon del sistema.',
      parameters: {
        type: 'object',
        properties: { theme: { type: 'string', enum: ['none', 'cyberpunk', 'matrix', 'synthwave'] } },
        required: ['theme'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_volume',
      description: 'Ajusta el volumen del sistema, de 0 a 100.',
      parameters: {
        type: 'object',
        properties: { level: { type: 'number' } },
        required: ['level'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_brightness',
      description: 'Ajusta el brillo de pantalla, de 0 a 100.',
      parameters: {
        type: 'object',
        properties: { level: { type: 'number' } },
        required: ['level'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_desktop_state',
      description: 'Devuelve las ventanas abiertas actualmente (appId, título, si está minimizada/maximizada). Usalo si no estás seguro de qué hay abierto antes de cerrar o enfocar algo.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export default async function handler(req, res) {
  // CORS básico (útil si en algún momento el frontend vive en otro dominio).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usá POST.' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: 'GROQ_API_KEY no configurada. Agregala en Vercel → Settings → Environment Variables.',
    });
  }

  const {
    messages,
    model = 'llama-3.3-70b-versatile',
    maxTokens = 700,
    temperature = 0.25,
    useTools = false,
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array "messages" no vacío.' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(useTools ? { tools: ASSISTANT_TOOLS, tool_choice: 'auto' } : {}),
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => '');
      return res
        .status(groqRes.status)
        .json({ error: `Groq ${groqRes.status}: ${text.slice(0, 300)}` });
    }

    const data = await groqRes.json();
    const message = data.choices?.[0]?.message ?? { role: 'assistant', content: '' };
    // `content` se mantiene por compatibilidad con callers existentes (NEX AI en Nex Code);
    // `message` trae el objeto completo (incl. tool_calls) para el loop de Nex Assistant.
    return res.status(200).json({ content: message.content ?? '', message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
