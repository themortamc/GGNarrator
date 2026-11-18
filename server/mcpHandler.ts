import crypto from 'crypto';
import {
  DEFAULT_MORTUPS_SCRIPT,
  DEFAULT_VOICE_STYLE,
  VOICE_OPTIONS,
  analyzeScript,
  formatDuration,
} from '../src/utils/scriptAnalysis.ts';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpGeneratedAudioOutput {
  downloadUrl: string;
  voiceName: string;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
  model: string;
}

export interface McpDependencies {
  generateAudio: (args: {
    text: string;
    style: string;
    voiceName: string;
    autoProsody?: boolean;
  }) => Promise<McpGeneratedAudioOutput>;
}

const MCP_PROTOCOL_VERSION = '2025-03-26';

const MCP_TOOLS = [
  {
    name: 'obtener_guion_mortups',
    description:
      'Devuelve el guion comercial original de Mortups en español rioplatense neutro, su desglose por bloques, la dirección actoral por defecto y las voces disponibles.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'generar_locucion',
    description:
      'Sintetiza una locución comercial en audio WAV (24 kHz mono) usando gemini-3.8-flash-tts y devuelve el enlace de descarga directo junto con la duración.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'Texto a locutar (usá "..." para pausas respiratorias). Si se omite, usa el guion comercial completo de Mortups.',
        },
        style: {
          type: 'string',
          description:
            'Indicación actoral de estilo (ritmo, tono, acento rioplatense neutro). Si se omite, usa la dirección comercial estándar de Mortups.',
        },
        voiceName: {
          type: 'string',
          enum: VOICE_OPTIONS.map((v) => v.id),
          description:
            'Voz base de Gemini 3.8 Flash TTS (por defecto: Puck).',
        },
        autoProsody: {
          type: 'boolean',
          description:
            'Si es true (por defecto), analiza texto normal e inserta pausas y respiraciones naturales automáticamente.',
        },
      },
      additionalProperties: false,
    },
  },
];

export function checkBearerAuth(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined
): boolean {
  const configured = expectedToken?.trim();
  if (!configured) {
    return true;
  }
  if (!authorizationHeader) {
    return false;
  }
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }
  const provided = match[1].trim();
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export async function handleMcpJsonRpc(
  payload: unknown,
  deps: McpDependencies
): Promise<{ status: number; body: JsonRpcResponse | null }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Solicitud JSON-RPC inválida.',
        },
      },
    };
  }

  const req = payload as JsonRpcRequest;
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return {
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: {
          code: -32600,
          message: 'Se requiere jsonrpc "2.0" y un método válido.',
        },
      },
    };
  }

  // Notifications have no id and expect HTTP 202 with no body
  if (req.id === undefined) {
    return { status: 202, body: null };
  }

  const id = req.id;

  if (req.method === 'initialize') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'mortups-locucion-tts',
            version: '1.0.0',
          },
        },
      },
    };
  }

  if (req.method === 'ping') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {},
      },
    };
  }

  if (req.method === 'tools/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      },
    };
  }

  if (req.method === 'tools/call') {
    const params = req.params ?? {};
    const toolName = typeof params.name === 'string' ? params.name : '';
    const args =
      params.arguments && typeof params.arguments === 'object'
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (toolName === 'obtener_guion_mortups') {
      const analysis = analyzeScript(DEFAULT_MORTUPS_SCRIPT);
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    script: DEFAULT_MORTUPS_SCRIPT,
                    defaultStyle: DEFAULT_VOICE_STYLE,
                    defaultVoice: 'Puck',
                    voices: VOICE_OPTIONS,
                    analysis,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        },
      };
    }

    if (toolName === 'generar_locucion') {
      const text =
        typeof args.text === 'string' && args.text.trim().length > 0
          ? args.text
          : DEFAULT_MORTUPS_SCRIPT;
      const style =
        typeof args.style === 'string' && args.style.trim().length > 0
          ? args.style
          : DEFAULT_VOICE_STYLE;
      const voiceName =
        typeof args.voiceName === 'string' && args.voiceName.trim().length > 0
          ? args.voiceName
          : 'Puck';
      const autoProsody =
        typeof args.autoProsody === 'boolean' ? args.autoProsody : true;

      try {
        const generated = await deps.generateAudio({
          text,
          style,
          voiceName,
          autoProsody,
        });

        const summaryLines = [
          `Locución generada con ${generated.model} (voz ${generated.voiceName}).`,
          `Duración: ${formatDuration(generated.durationSeconds)} (${generated.durationSeconds.toFixed(1)} s) · ${Math.round(generated.sampleRate / 1000)} kHz WAV · ${Math.max(1, Math.round(generated.byteLength / 1024))} KB.`,
          `Descargar / escuchar WAV: ${generated.downloadUrl}`,
        ];

        return {
          status: 200,
          body: {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: summaryLines.join('\n'),
                },
              ],
              structuredContent: generated,
            },
          },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error al generar audio.';
        return {
          status: 200,
          body: {
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: message,
                },
              ],
            },
          },
        };
      }
    }

    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Herramienta desconocida: ${toolName}`,
        },
      },
    };
  }

  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Método MCP no soportado: ${req.method}`,
      },
    },
  };
}
