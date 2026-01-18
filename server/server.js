import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '200kb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const PORT = Number(process.env.PORT || 8787);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/factcheck', async (req, res) => {
  try {
    const claim = String(req.body?.claim || '').trim();
    const url = req.body?.url ? String(req.body.url) : null;

    if (!claim) {
      return res.status(400).json({ error: 'Missing claim' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Server missing OPENAI_API_KEY. Create server/.env from .env.example and restart.'
      });
    }

    // Ask the model to use web search, then return a STRICT JSON object.
    // NOTE: The model must cite sources and ONLY use sources it can point to.
    const system = {
      role: 'system',
      content:
        'Fact-check quickly. Use at most 2 web sources. ' +
        'If evidence is not found within a short search, return Unclear. ' +
        'Do not keep searching. Output JSON only.'
    };

    const user = {
      role: 'user',
      content:
        `Fact-check this claim:\n"${claim}"\n\n` +
        (url ? `Context URL (where user saw it): ${url}\n\n` : '') +
        'Return your answer in the required JSON format.'
    };

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        verdict: {
          type: 'string',
          description: 'One of: True, False, Misleading, Unclear'
        },
        confidence: {
          type: 'string',
          description: 'One of: High, Medium, Low'
        },
        explanation: {
          type: 'string',
          description: 'Short explanation (2-6 sentences), focused on what sources say.'
        },
        sources: {
          type: 'array',
          description: 'Cited sources used to reach the verdict. 2-6 sources ideally.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              publisher: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD if possible' }
            },
            required: ['url']
          }
        }
      },
      required: ['verdict', 'confidence', 'explanation', 'sources']
    };

    const payload = {
      model: MODEL,
      input: [system, user],
      tools: [{ type: 'web_search' }],
      // Ask for strict structured JSON
      text: {
        format: {
          type: 'json_schema',
          name: 'fact_check_result',
          strict: false,
          schema
        }
      },
      // Helpful for debugging: includes tool sources
      include: ['web_search_call.action.sources'],
      // Avoid storing user data by default
      store: false
    };

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(502).json({ error: 'OpenAI API error', status: r.status, details: txt });
    }

    const out = await r.json();

    // The structured JSON is typically available in out.output_text for SDK,
    // but via REST we can safely extract the first message text.
    // We'll search for an output item with type "message" and read its content.
    let resultJson = null;

    try {
      // Many Responses return an array in out.output; message content is often in output[0].content[0].text
      for (const item of out.output || []) {
        if (item.type === 'message') {
          const parts = item.content || [];
          for (const p of parts) {
            if (p.type === 'output_text' && typeof p.text === 'string') {
              resultJson = JSON.parse(p.text);
              break;
            }
          }
        }
        if (resultJson) break;
      }
    } catch (_e) {
      // fall through
    }

    if (!resultJson) {
      // As a fallback, return raw so you can debug.
      return res.status(502).json({
        error: 'Could not parse structured JSON from model response',
        raw: out
      });
    }

    // Optionally attach raw response for debugging (comment out in production)
    resultJson.raw = {
      response_id: out.id,
      model: out.model,
      usage: out.usage || null,
      tool_sources: out?.output?.filter(i => i.type === 'web_search_call') || []
    };

    res.json(resultJson);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Fact-check backend running on http://localhost:${PORT}`);
});
