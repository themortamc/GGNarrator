import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  parseWavMetadata,
  validateTtsRequest,
} from './src/utils/scriptAnalysis.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTS_MODEL = 'gemini-3.8-flash-tts';

function resolvePort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const parsed = Number(process.argv[portFlagIndex + 1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Number(process.env.PORT ?? 3000);
}

const PORT = resolvePort();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const statusMatch = raw.match(/\b(400|401|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 500;

  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || statusCode === 403) {
    return {
      status: 403,
      message:
        'La clave de Gemini API no es válida o no tiene permisos. Verificá GEMINI_API_KEY en Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || statusCode === 429) {
    return {
      status: 429,
      message:
        'Se alcanzó el límite de solicitudes para Gemini TTS. Esperá unos segundos o revisá la cuota en Settings > Secrets.',
    };
  }
  if (raw.includes('NOT_FOUND') || statusCode === 404) {
    return {
      status: 404,
      message: `El modelo ${TTS_MODEL} no estuvo disponible para esta solicitud.`,
    };
  }
  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: `No se pudo generar el audio en este momento: ${raw}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: TTS_MODEL,
      configured: Boolean(getGeminiClient()),
    });
  });

  app.post('/api/tts/generate', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const style = typeof req.body?.style === 'string' ? req.body.style : '';
    const voiceName =
      typeof req.body?.voiceName === 'string' ? req.body.voiceName : 'Puck';

    const validation = validateTtsRequest({ text, style, voiceName });
    if (!validation.valid) {
      const firstError =
        validation.errors.text ??
        validation.errors.style ??
        validation.errors.voiceName ??
        'Datos de entrada inválidos.';
      res.status(400).json({ error: firstError, errors: validation.errors });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY no está configurada en el servidor. Configurala en Settings > Secrets para generar la locución real.',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: style.trim(),
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const audioPart = parts.find((part) => Boolean(part.inlineData?.data));
      const base64Audio = audioPart?.inlineData?.data;
      const mimeType = audioPart?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        res.status(502).json({
          error:
            'El modelo no devolvió datos de audio en la respuesta. Intentá nuevamente.',
        });
        return;
      }

      const wavBytes = Buffer.from(base64Audio, 'base64');
      const wavMeta = parseWavMetadata(new Uint8Array(wavBytes));

      res.json({
        audioBase64: base64Audio,
        mimeType,
        model: TTS_MODEL,
        voiceName,
        durationSeconds: wavMeta.durationSeconds,
        sampleRate: wavMeta.sampleRate,
        byteLength: wavBytes.length,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr:
          process.env.DISABLE_HMR === 'true'
            ? false
            : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Mortups TTS Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
