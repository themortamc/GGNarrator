import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBearerAuth, handleMcpJsonRpc } from './mcpHandler';

const mockDeps = {
  async generateAudio(args: { text: string; style: string; voiceName: string }) {
    if (!args.text.trim()) {
      throw new Error('Texto vacío');
    }
    return {
      downloadUrl: 'https://example.com/api/tts/files/abc123.wav',
      voiceName: args.voiceName,
      durationSeconds: 29.4,
      sampleRate: 24000,
      byteLength: 1411244,
      model: 'gemini-3.8-flash-tts',
    };
  },
};

test('MCP initialize returns protocol version and server capabilities', async () => {
  const res = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    mockDeps
  );
  assert.equal(res.status, 200);
  assert.equal(res.body?.id, 1);
  const result = res.body?.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, '2025-03-26');
});

test('MCP notifications return 202 with empty body', async () => {
  const res = await handleMcpJsonRpc(
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    mockDeps
  );
  assert.equal(res.status, 202);
  assert.equal(res.body, null);
});

test('MCP tools/list exposes obtener_guion_mortups and generar_locucion', async () => {
  const res = await handleMcpJsonRpc(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    mockDeps
  );
  const result = res.body?.result as { tools: Array<{ name: string }> };
  assert.deepEqual(
    result.tools.map((t) => t.name),
    ['obtener_guion_mortups', 'generar_locucion']
  );
});

test('MCP tools/call generar_locucion returns WAV URL and duration', async () => {
  const res = await handleMcpJsonRpc(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'generar_locucion',
        arguments: { voiceName: 'Fenrir' },
      },
    },
    mockDeps
  );
  assert.equal(res.status, 200);
  const result = res.body?.result as {
    content: Array<{ text: string }>;
    structuredContent: { voiceName: string; downloadUrl: string };
  };
  assert.equal(result.structuredContent.voiceName, 'Fenrir');
  assert.match(result.content[0].text, /https:\/\/example\.com\/api\/tts\/files\/abc123\.wav/);
});

test('checkBearerAuth allows when MCP_AUTH_TOKEN is unset and validates when set', () => {
  assert.equal(checkBearerAuth(undefined, undefined), true);
  assert.equal(checkBearerAuth(undefined, ''), true);
  assert.equal(checkBearerAuth(undefined, 'secret-123'), false);
  assert.equal(checkBearerAuth('Bearer wrong', 'secret-123'), false);
  assert.equal(checkBearerAuth('Bearer secret-123', 'secret-123'), true);
});
