import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_MORTUPS_SCRIPT,
  DEFAULT_VOICE_STYLE,
  parseWavMetadata,
  validateTtsRequest,
} from '../src/utils/scriptAnalysis.ts';

export const TTS_MODEL = 'gemini-3.8-flash-tts';

export interface SynthesizeSpeechInput {
  text?: string;
  style?: string;
  voiceName?: string;
}

export interface SynthesizeSpeechResult {
  audioBase64: string;
  wavBuffer: Buffer;
  mimeType: string;
  model: string;
  voiceName: string;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
}

export class TtsServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface StoredAudioFile {
  id: string;
  buffer: Buffer;
  mimeType: string;
  voiceName: string;
  durationSeconds: number;
  createdAt: number;
}

const MAX_STORED_FILES = 50;
const FILE_TTL_MS = 30 * 60 * 1000;
const audioStore = new Map<string, StoredAudioFile>();

function pruneAudioStore(): void {
  const now = Date.now();
  for (const [id, entry] of audioStore.entries()) {
    if (now - entry.createdAt > FILE_TTL_MS) {
      audioStore.delete(id);
    }
  }
  while (audioStore.size > MAX_STORED_FILES) {
    const oldestKey = audioStore.keys().next().value;
    if (!oldestKey) {
      break;
    }
    audioStore.delete(oldestKey);
  }
}

export function saveGeneratedAudioFile(params: {
  buffer: Buffer;
  mimeType: string;
  voiceName: string;
  durationSeconds: number;
}): StoredAudioFile {
  pruneAudioStore();
  const id = crypto.randomBytes(12).toString('hex');
  const entry: StoredAudioFile = {
    id,
    buffer: params.buffer,
    mimeType: params.mimeType,
    voiceName: params.voiceName,
    durationSeconds: params.durationSeconds,
    createdAt: Date.now(),
  };
  audioStore.set(id, entry);
  return entry;
}

export function getStoredAudioFile(id: string): StoredAudioFile | null {
  pruneAudioStore();
  return audioStore.get(id) ?? null;
}

export function getGeminiClient(): GoogleGenAI | null {
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

function mapGeminiError(error: unknown): TtsServiceError {
  const raw = error instanceof Error ? error.message : String(error);
  const statusMatch = raw.match(/\b(400|401|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 500;

  if (
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('API_KEY_INVALID') ||
    statusCode === 403
  ) {
    return new TtsServiceError(
      403,
      'La clave de Gemini API no es válida o no tiene permisos. Verificá GEMINI_API_KEY en Settings > Secrets.'
    );
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || statusCode === 429) {
    return new TtsServiceError(
      429,
      'Se alcanzó el límite de solicitudes para Gemini TTS. Esperá unos segundos o revisá la cuota en Settings > Secrets.'
    );
  }
  if (raw.includes('NOT_FOUND') || statusCode === 404) {
    return new TtsServiceError(
      404,
      `El modelo ${TTS_MODEL} no estuvo disponible para esta solicitud.`
    );
  }
  return new TtsServiceError(
    statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    `No se pudo generar el audio en este momento: ${raw}`
  );
}

export async function synthesizeWavSpeech(
  input: SynthesizeSpeechInput
): Promise<SynthesizeSpeechResult> {
  const text =
    typeof input.text === 'string' ? input.text : DEFAULT_MORTUPS_SCRIPT;
  const style =
    typeof input.style === 'string' && input.style.trim().length > 0
      ? input.style
      : DEFAULT_VOICE_STYLE;
  const voiceName =
    typeof input.voiceName === 'string' && input.voiceName.trim().length > 0
      ? input.voiceName
      : 'Puck';

  const validation = validateTtsRequest({ text, style, voiceName });
  if (!validation.valid) {
    const firstError =
      validation.errors.text ??
      validation.errors.style ??
      validation.errors.voiceName ??
      'Datos de entrada inválidos.';
    throw new TtsServiceError(400, firstError);
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new TtsServiceError(
      503,
      'GEMINI_API_KEY no está configurada en el servidor. Configurala en Settings > Secrets para generar la locución real.'
    );
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
      throw new TtsServiceError(
        502,
        'El modelo no devolvió datos de audio en la respuesta. Intentá nuevamente.'
      );
    }

    const wavBuffer = Buffer.from(base64Audio, 'base64');
    const wavMeta = parseWavMetadata(new Uint8Array(wavBuffer));

    return {
      audioBase64: base64Audio,
      wavBuffer,
      mimeType,
      model: TTS_MODEL,
      voiceName,
      durationSeconds: wavMeta.durationSeconds,
      sampleRate: wavMeta.sampleRate,
      byteLength: wavBuffer.length,
    };
  } catch (error) {
    if (error instanceof TtsServiceError) {
      throw error;
    }
    throw mapGeminiError(error);
  }
}
