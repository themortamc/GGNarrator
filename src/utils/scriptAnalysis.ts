export type VoiceName = 'Puck' | 'Fenrir' | 'Charon' | 'Kore' | 'Zephyr';

export interface VoiceOption {
  id: VoiceName;
  label: string;
  profile: string;
  recommended?: boolean;
}

export interface StylePreset {
  id: string;
  label: string;
  summary: string;
  stylePrompt: string;
}

export interface ScriptBlock {
  index: number;
  label: string;
  text: string;
  wordCount: number;
  ellipsisCount: number;
  estimatedSeconds: number;
}

export interface ScriptAnalysis {
  blocks: ScriptBlock[];
  paragraphCount: number;
  wordCount: number;
  ellipsisCount: number;
  sentenceBreakCount: number;
  questionCount: number;
  estimatedDurationSeconds: number;
}

export interface TtsValidationResult {
  valid: boolean;
  errors: {
    text?: string;
    style?: string;
    voiceName?: string;
  };
}

export interface WavMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSeconds: number;
}

export const DEFAULT_MORTUPS_SCRIPT = [
  'Tener una página web linda... ya no alcanza. Si entran visitas y nadie te escribe, estás perdiendo clientes todos los días.',
  'En Mortups diseñamos sitios web rápidos y estrategias de marketing online... pensadas para una sola cosa: convertir visitas en consultas reales.',
  'Sin vueltas técnicas. Nosotros armamos tu presencia digital de punta a punta, para que vos te ocupes de atender tu negocio.',
  '¿Querés que tu web empiece a traer clientes de verdad? Escribinos hoy... y hagamos crecer tu marca.',
].join('\n\n');

export const DEFAULT_VOICE_STYLE =
  'Locutor comercial joven, cercano y seguro, en español rioplatense neutro. Ritmo ágil, tono conversacional y natural, sin sonar exagerado ni como publicidad de radio antigua. Respetar las pausas marcadas con puntos suspensivos y hacer un cierre firme.';

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'Puck',
    label: 'Puck',
    profile: 'Joven, ágil y cercano — ideal para ritmo conversacional',
    recommended: true,
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    profile: 'Grave, firme y resolutivo — marca presencia en el cierre',
  },
  {
    id: 'Charon',
    label: 'Charon',
    profile: 'Cálido, sobrio y confiable — impronta consultiva',
  },
  {
    id: 'Kore',
    label: 'Kore',
    profile: 'Clara, moderna y directa — articulación limpia',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    profile: 'Fresca, dinámica y natural — cadencia liviana',
  },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'comercial-cercano',
    label: 'Comercial cercano',
    summary: 'Dirección original del guion: ágil, natural y con cierre firme',
    stylePrompt: DEFAULT_VOICE_STYLE,
  },
  {
    id: 'dinamico-digital',
    label: 'Dinámico digital',
    summary: 'Ritmo un poco más veloz para pauta en redes y video vertical',
    stylePrompt:
      'Locutor comercial joven y dinámico en español rioplatense neutro. Lectura fluida para anuncio digital, tono cercano y directo, respiraciones breves en puntos suspensivos y remate enérgico sin exageración.',
  },
  {
    id: 'consultivo-firme',
    label: 'Consultivo y firme',
    summary: 'Cadencia levemente más pausada para transmitir respaldo técnico',
    stylePrompt:
      'Locutor comercial joven, seguro y sereno en español rioplatense neutro. Tono conversacional de confianza, pausas marcadas en los puntos suspensivos para enfatizar cada idea y cierre contundente.',
  },
];

const BLOCK_ROLE_LABELS = [
  '01. Gancho inicial',
  '02. Propuesta de valor',
  '03. Diferencial práctico',
  '04. Cierre y llamado',
];

const VALID_VOICE_SET = new Set<string>(VOICE_OPTIONS.map((v) => v.id));

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) {
    return 0;
  }
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function estimateBlockDurationSeconds(text: string): number {
  const words = countWords(text);
  if (words === 0) {
    return 0;
  }
  const ellipsisCount = (text.match(/\.\.\./g) ?? []).length;
  const withoutEllipsis = text.replace(/\.\.\./g, ' ');
  const sentenceBreaks = (withoutEllipsis.match(/[.!?]+/g) ?? []).length;
  // ~150 WPM (2.5 words/sec) for agile commercial Spanish + deliberate breath pauses
  const baseSpeechSeconds = words / 2.5;
  const pauseSeconds = ellipsisCount * 0.55 + sentenceBreaks * 0.3;
  return Math.max(1, Math.round(baseSpeechSeconds + pauseSeconds));
}

export function analyzeScript(text: string): ScriptAnalysis {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return {
      blocks: [],
      paragraphCount: 0,
      wordCount: 0,
      ellipsisCount: 0,
      sentenceBreakCount: 0,
      questionCount: 0,
      estimatedDurationSeconds: 0,
    };
  }

  const rawParagraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: ScriptBlock[] = rawParagraphs.map((paragraph, idx) => {
    const wordCount = countWords(paragraph);
    const ellipsisCount = (paragraph.match(/\.\.\./g) ?? []).length;
    const label =
      BLOCK_ROLE_LABELS[idx] ??
      `${String(idx + 1).padStart(2, '0')}. Bloque adicional`;
    return {
      index: idx,
      label,
      text: paragraph,
      wordCount,
      ellipsisCount,
      estimatedSeconds: estimateBlockDurationSeconds(paragraph),
    };
  });

  const ellipsisCount = (normalized.match(/\.\.\./g) ?? []).length;
  const withoutEllipsis = normalized.replace(/\.\.\./g, ' ');
  const sentenceBreakCount = (withoutEllipsis.match(/[.!?]+/g) ?? []).length;
  const questionCount = (normalized.match(/\?/g) ?? []).length;
  const wordCount = blocks.reduce((sum, b) => sum + b.wordCount, 0);
  const interBlockPause = Math.max(0, blocks.length - 1) * 0.45;
  const estimatedDurationSeconds = Math.round(
    blocks.reduce((sum, b) => sum + b.estimatedSeconds, 0) + interBlockPause
  );

  return {
    blocks,
    paragraphCount: blocks.length,
    wordCount,
    ellipsisCount,
    sentenceBreakCount,
    questionCount,
    estimatedDurationSeconds,
  };
}

export function validateTtsRequest(input: {
  text: string;
  style: string;
  voiceName: string;
}): TtsValidationResult {
  const errors: TtsValidationResult['errors'] = {};
  const trimmedText = input.text.trim();
  const trimmedStyle = input.style.trim();

  if (!trimmedText) {
    errors.text = 'Ingresá el guion antes de generar la locución.';
  } else if (trimmedText.length > 4000) {
    errors.text = 'El guion supera el máximo permitido de 4000 caracteres.';
  }

  if (!trimmedStyle) {
    errors.style = 'Definí una dirección actoral para guiar la lectura.';
  } else if (trimmedStyle.length > 1000) {
    errors.style = 'La dirección actoral no puede superar los 1000 caracteres.';
  }

  if (!VALID_VOICE_SET.has(input.voiceName)) {
    errors.voiceName = 'Seleccioná una voz válida.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function parseWavMetadata(bytes: Uint8Array): WavMetadata {
  if (bytes.length < 44) {
    return {
      sampleRate: 24000,
      channels: 1,
      bitsPerSample: 16,
      dataBytes: 0,
      durationSeconds: 0,
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff =
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF';
  const wave =
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WAVE';

  if (!riff || !wave) {
    const fallbackBytes = Math.max(0, bytes.length - 44);
    return {
      sampleRate: 24000,
      channels: 1,
      bitsPerSample: 16,
      dataBytes: fallbackBytes,
      durationSeconds: fallbackBytes / (24000 * 2),
    };
  }

  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 24000;
  const byteRate = view.getUint32(28, true) || sampleRate * channels * 2;
  const bitsPerSample = view.getUint16(34, true) || 16;

  // Locate 'data' subchunk safely
  let offset = 12;
  let dataBytes = Math.max(0, bytes.length - 44);
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataBytes = Math.min(chunkSize, bytes.length - (offset + 8));
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  const durationSeconds = byteRate > 0 ? dataBytes / byteRate : 0;
  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationSeconds,
  };
}
