import { ThinkingLevel, Type } from '@google/genai';
import { analyzeProsody } from '../src/utils/prosodyAnalyzer.ts';
import { getGeminiClient, TtsServiceError } from './ttsService.ts';

export const PROSODY_MODEL = 'gemini-4-hydrogen';

export interface AiProsodyResult {
  annotatedText: string;
  notes: string;
  model: string;
}

export async function analyzeScriptProsodyWithAi(params: {
  text: string;
  style?: string;
}): Promise<AiProsodyResult> {
  const trimmed = params.text.trim();
  if (!trimmed) {
    throw new TtsServiceError(
      400,
      'Ingresá un texto antes de analizar pausas y respiraciones con IA.'
    );
  }
  if (trimmed.length > 4000) {
    throw new TtsServiceError(
      400,
      'El guion supera el máximo permitido de 4000 caracteres.'
    );
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new TtsServiceError(
      503,
      'GEMINI_API_KEY no está configurada en el servidor. Configurala en Settings > Secrets.'
    );
  }

  try {
    const response = await ai.models.generateContent({
      model: PROSODY_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Analizá el siguiente guion en español rioplatense/neutro y preparalo para locución comercial natural.',
                params.style?.trim()
                  ? `Dirección deseada: ${params.style.trim()}`
                  : '',
                '',
                'Texto del usuario:',
                trimmed,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: [
          'Sos un director de locución comercial en español rioplatense.',
          'Tu trabajo es tomar texto normal (incluso si le faltan comas, puntos o saltos de párrafo) y prepararlo para lectura natural en Gemini TTS.',
          'Reglas estrictas:',
          '1. Conservá TODAS las palabras, marcas, números y sentido original sin inventar ni quitar contenido.',
          '2. Agregá puntuación natural (comas, puntos seguidos, signos de pregunta ¿...?) si faltan.',
          '3. Insertá puntos suspensivos "..." únicamente donde convenga una micro-pausa intencional para enfatizar o dar aire (entre 2 y 5 veces en un spot de 30s).',
          '4. Insertá la etiqueta literal "<breath>" (entre 1 y 3 veces por guion, nunca en todas las oraciones) al inicio de transiciones importantes para simular una respiración humana natural.',
          '5. Dividí el guion en párrafos claros separados por línea en blanco cuando haya bloques de idea distintos.',
        ].join(' '),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            annotatedText: {
              type: Type.STRING,
              description:
                'El guion completo preparado con puntuación natural, pausas (...) y etiquetas <breath>.',
            },
            notes: {
              type: Type.STRING,
              description:
                'Resumen breve en 1 oración de las pausas y respiraciones agregadas.',
            },
          },
          required: ['annotatedText', 'notes'],
        },
      },
    });

    const rawJson = (response.text ?? '').trim();
    if (!rawJson) {
      throw new TtsServiceError(
        502,
        'La IA no devolvió una propuesta de ritmo válida.'
      );
    }

    const parsed = JSON.parse(rawJson) as {
      annotatedText?: string;
      notes?: string;
    };

    const annotatedText = (parsed.annotatedText ?? '').trim();
    if (!annotatedText) {
      throw new TtsServiceError(
        502,
        'La respuesta de análisis de prosodia vino vacía.'
      );
    }

    return {
      annotatedText,
      notes:
        parsed.notes?.trim() ||
        'Pausas conversacionales y respiraciones agregadas según la estructura del texto.',
      model: PROSODY_MODEL,
    };
  } catch (error) {
    if (error instanceof TtsServiceError) {
      throw error;
    }
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
      throw new TtsServiceError(
        429,
        'Se alcanzó el límite temporal de solicitudes para el análisis con IA. El modo automático local sigue funcionando normalmente.'
      );
    }
    if (raw.includes('UNAVAILABLE') || raw.includes('503')) {
      throw new TtsServiceError(
        503,
        'El análisis con IA está momentáneamente con alta demanda. El modo de pausas y respiraciones automáticas sigue activo sin esperas.'
      );
    }
    throw new TtsServiceError(
      500,
      `No se pudo completar el análisis con IA: ${raw}`
    );
  }
}

export interface AutoProsodyPreparation {
  preparedText: string;
  autoPausesCount: number;
  autoBreathsCount: number;
  usedAi: boolean;
}

function countWordsSimple(text: string): number {
  const cleaned = text.replace(/<breath>/gi, ' ').trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function countPattern(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

export async function prepareAutoProsodyText(params: {
  text: string;
  style?: string;
  analyzeWithAi?: typeof analyzeScriptProsodyWithAi;
  timeoutMs?: number;
}): Promise<AutoProsodyPreparation> {
  const baseline = analyzeProsody(params.text);
  const originalWords = countWordsSimple(params.text);
  const originalPauses = countPattern(params.text, /\.\.\./g);
  const originalBreaths = countPattern(params.text, /<breath>/gi);

  if (originalWords === 0) {
    return {
      preparedText: baseline.preparedText,
      autoPausesCount: baseline.autoPausesCount,
      autoBreathsCount: baseline.autoBreathsCount,
      usedAi: false,
    };
  }

  const aiRunner = params.analyzeWithAi ?? analyzeScriptProsodyWithAi;
  const timeoutMs = params.timeoutMs ?? 10000;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const aiResult = await Promise.race([
      aiRunner({ text: params.text, style: params.style }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Tiempo de espera agotado al optimizar el ritmo.')),
          timeoutMs
        );
      }),
    ]);

    const candidate = aiResult.annotatedText.trim();
    const candidateWords = countWordsSimple(candidate);
    const ratio = originalWords > 0 ? candidateWords / originalWords : 0;

    if (candidate && ratio >= 0.6 && ratio <= 1.6) {
      const normalizedAi = analyzeProsody(candidate);
      return {
        preparedText: normalizedAi.preparedText,
        autoPausesCount: Math.max(
          0,
          normalizedAi.totalPausesCount - originalPauses
        ),
        autoBreathsCount: Math.max(
          0,
          normalizedAi.totalBreathsCount - originalBreaths
        ),
        usedAi: true,
      };
    }
  } catch {
    // Fallback cleanly to deterministic prosody analysis if AI is unavailable or rate-limited
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }

  return {
    preparedText: baseline.preparedText,
    autoPausesCount: baseline.autoPausesCount,
    autoBreathsCount: baseline.autoBreathsCount,
    usedAi: false,
  };
}

