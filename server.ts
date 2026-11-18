import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkBearerAuth, handleMcpJsonRpc } from './server/mcpHandler.ts';
import {
  TTS_MODEL,
  TtsServiceError,
  getGeminiClient,
  getStoredAudioFile,
  saveGeneratedAudioFile,
  synthesizeWavSpeech,
} from './server/ttsService.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function resolvePublicBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

const PORT = resolvePort();

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: TTS_MODEL,
      configured: Boolean(getGeminiClient()),
      mcp: '/mcp',
      mcpAuthRequired: Boolean(process.env.MCP_AUTH_TOKEN?.trim()),
    });
  });

  app.post('/api/tts/generate', async (req, res) => {
    try {
      const result = await synthesizeWavSpeech({
        text: typeof req.body?.text === 'string' ? req.body.text : '',
        style: typeof req.body?.style === 'string' ? req.body.style : '',
        voiceName:
          typeof req.body?.voiceName === 'string' ? req.body.voiceName : 'Puck',
      });

      res.json({
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        model: result.model,
        voiceName: result.voiceName,
        durationSeconds: result.durationSeconds,
        sampleRate: result.sampleRate,
        byteLength: result.byteLength,
      });
    } catch (error) {
      if (error instanceof TtsServiceError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Error interno del servidor.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tts/wav', async (req, res) => {
    if (
      !checkBearerAuth(req.get('authorization'), process.env.MCP_AUTH_TOKEN)
    ) {
      res.status(401).json({
        error: 'Token Bearer inválido o ausente para /api/tts/wav.',
      });
      return;
    }

    try {
      const result = await synthesizeWavSpeech({
        text: typeof req.body?.text === 'string' ? req.body.text : undefined,
        style: typeof req.body?.style === 'string' ? req.body.style : undefined,
        voiceName:
          typeof req.body?.voiceName === 'string'
            ? req.body.voiceName
            : undefined,
      });

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="mortups-${result.voiceName.toLowerCase()}.wav"`
      );
      res.setHeader('X-Audio-Duration', result.durationSeconds.toFixed(2));
      res.send(result.wavBuffer);
    } catch (error) {
      if (error instanceof TtsServiceError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Error interno del servidor.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/tts/files/:fileName', (req, res) => {
    const rawId = req.params.fileName.replace(/\.wav$/i, '');
    const stored = getStoredAudioFile(rawId);
    if (!stored) {
      res.status(404).json({
        error: 'Archivo WAV no encontrado o expirado.',
      });
      return;
    }
    res.setHeader('Content-Type', stored.mimeType || 'audio/wav');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="mortups-${stored.voiceName.toLowerCase()}.wav"`
    );
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.send(stored.buffer);
  });

  app.options('/mcp', (_req, res) => {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    res.status(204).end();
  });

  app.get('/mcp', (req, res) => {
    const acceptHeader = req.get('accept') || '';
    if (acceptHeader.includes('text/event-stream')) {
      if (
        !checkBearerAuth(req.get('authorization'), process.env.MCP_AUTH_TOKEN)
      ) {
        res.status(401).json({ error: 'Bearer token requerido o inválido.' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(': mcp-sse-ready\n\n');

      const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 25000);

      req.on('close', () => {
        clearInterval(keepAlive);
      });
      return;
    }

    res.status(200).json({
      status: 'ready',
      name: 'mortups-locucion-tts',
      protocol: 'MCP Streamable HTTP (2025-03-26)',
      transport: {
        rpc: 'POST /mcp (application/json, JSON-RPC 2.0)',
        sse: 'GET /mcp (Accept: text/event-stream)',
      },
      tools: ['obtener_guion_mortups', 'generar_locucion'],
      authRequired: Boolean(process.env.MCP_AUTH_TOKEN?.trim()),
    });
  });

  app.delete('/mcp', (req, res) => {
    if (
      !checkBearerAuth(req.get('authorization'), process.env.MCP_AUTH_TOKEN)
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json({ ok: true });
  });

  app.post('/mcp', async (req, res) => {
    if (
      !checkBearerAuth(req.get('authorization'), process.env.MCP_AUTH_TOKEN)
    ) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Bearer token requerido o inválido.',
        },
      });
      return;
    }

    const incomingSessionId = req.get('mcp-session-id');
    const sessionId = incomingSessionId || crypto.randomUUID();

    const rpcResponse = await handleMcpJsonRpc(req.body, {
      generateAudio: async ({ text, style, voiceName }) => {
        const result = await synthesizeWavSpeech({ text, style, voiceName });
        const saved = saveGeneratedAudioFile({
          buffer: result.wavBuffer,
          mimeType: result.mimeType,
          voiceName: result.voiceName,
          durationSeconds: result.durationSeconds,
        });
        const baseUrl = resolvePublicBaseUrl(req);
        return {
          downloadUrl: `${baseUrl}/api/tts/files/${saved.id}.wav`,
          voiceName: result.voiceName,
          durationSeconds: result.durationSeconds,
          sampleRate: result.sampleRate,
          byteLength: result.byteLength,
          model: result.model,
        };
      },
    });

    res.setHeader('Mcp-Session-Id', sessionId);
    if (rpcResponse.status === 202 || rpcResponse.body === null) {
      res.status(202).end();
      return;
    }
    res.status(rpcResponse.status).json(rpcResponse.body);
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
