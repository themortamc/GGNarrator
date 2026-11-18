export interface ProsodyAnalysisResult {
  preparedText: string;
  autoPausesCount: number;
  autoBreathsCount: number;
  totalPausesCount: number;
  totalBreathsCount: number;
  changed: boolean;
}

export interface ProsodyToken {
  type: 'text' | 'pause' | 'breath';
  value: string;
}

const PIVOT_PHRASES = [
  'sin embargo',
  'ahora bien',
  'en cambio',
  'por eso',
  'ya no',
  'pensadas para',
  'pensados para',
  'diseñadas para',
  'para que',
  'y hagamos',
  'y activá',
  'y empezá',
  'y convertí',
  'y hacé',
  'y llevá',
  'pero',
  'aunque',
];

const CLAUSE_BOUNDARY_WORDS = new Set([
  'para',
  'porque',
  'cuando',
  'donde',
  'mientras',
  'como',
  'aunque',
  'pero',
  'con',
  'sin',
  'y',
  'o',
]);

function countSpokenWords(text: string): number {
  const cleaned = text.replace(/<breath>/gi, ' ').trim();
  if (!cleaned) {
    return 0;
  }
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function countOccurrences(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

function insertNaturalPauseInSentence(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Respect sentences where the author already wrote explicit pause/breath cues
  if (trimmed.includes('...') || /<breath>/i.test(trimmed)) {
    return trimmed;
  }

  const words = trimmed.split(/\s+/);
  if (words.length < 7) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // 1. Look for a strong rhetorical pivot after at least 4 words
  for (const phrase of PIVOT_PHRASES) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:,\\s+|\\s+)(${escaped})(?=\\s+|[,.!?]|$)`, 'i');
    const match = regex.exec(lower);
    if (!match || match.index === undefined) {
      continue;
    }

    const prefix = trimmed.slice(0, match.index).trimEnd();
    const prefixWords = countSpokenWords(prefix);
    const suffixStart = match.index + (match[0].length - match[1].length);
    const suffix = trimmed.slice(suffixStart).trimStart();
    const suffixWords = countSpokenWords(suffix);

    if (prefixWords >= 4 && suffixWords >= 2) {
      const cleanPrefix = prefix.replace(/,\s*$/, '').trimEnd();
      // Avoid placing "..." right after ":" or ";" or terminal punctuation
      if (!/[.:;!?]$/.test(cleanPrefix)) {
        return `${cleanPrefix}... ${suffix}`;
      }
    }
  }

  // 2. For medium/long unbroken sentences (>= 11 words), add one natural mid-sentence breath pause
  if (words.length >= 11) {
    // Prefer upgrading a natural comma around the middle of the sentence
    const commaPositions: number[] = [];
    for (let i = 0; i < trimmed.length - 1; i += 1) {
      if (trimmed[i] === ',' && trimmed[i + 1] === ' ') {
        commaPositions.push(i);
      }
    }

    const totalWords = words.length;
    for (const pos of commaPositions) {
      const beforeWords = countSpokenWords(trimmed.slice(0, pos));
      const ratio = beforeWords / totalWords;
      if (beforeWords >= 5 && totalWords - beforeWords >= 4 && ratio >= 0.35 && ratio <= 0.75) {
        return `${trimmed.slice(0, pos)}... ${trimmed.slice(pos + 2).trimStart()}`;
      }
    }

    // Fallback: break before a natural preposition/conjunction near the middle
    let bestWordIdx = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const targetIdx = totalWords * 0.55;

    for (let idx = 4; idx <= totalWords - 4; idx += 1) {
      const normalizedWord = words[idx].toLowerCase().replace(/^[¿¡"'([]+|[.,!?:;"')\]-]+$/g, '');
      if (CLAUSE_BOUNDARY_WORDS.has(normalizedWord)) {
        const dist = Math.abs(idx - targetIdx);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestWordIdx = idx;
        }
      }
    }

    if (bestWordIdx !== -1) {
      const left = words.slice(0, bestWordIdx).join(' ').replace(/,\s*$/, '');
      const right = words.slice(bestWordIdx).join(' ');
      if (!/[.:;!?]$/.test(left)) {
        return `${left}... ${right}`;
      }
    }
  }

  return trimmed;
}

function splitParagraphIntoSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<!\.\.)(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function analyzeProsody(rawText: string): ProsodyAnalysisResult {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return {
      preparedText: '',
      autoPausesCount: 0,
      autoBreathsCount: 0,
      totalPausesCount: 0,
      totalBreathsCount: 0,
      changed: false,
    };
  }

  const originalPauses = countOccurrences(normalized, /\.\.\./g);
  const originalBreaths = countOccurrences(normalized, /<breath>/gi);

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const processedParagraphs = paragraphs.map((paragraph) => {
    const sentences = splitParagraphIntoSentences(paragraph);
    const enrichedSentences = sentences.map((s) => insertNaturalPauseInSentence(s));

    // If it's a single long plain paragraph (>= 26 words, >= 3 sentences) with no <breath>,
    // insert one natural breath near the midpoint between sentences.
    if (
      paragraphs.length === 1 &&
      enrichedSentences.length >= 3 &&
      countSpokenWords(paragraph) >= 26 &&
      !/<breath>/i.test(paragraph)
    ) {
      const midIdx = Math.floor(enrichedSentences.length / 2);
      enrichedSentences[midIdx] = `<breath> ${enrichedSentences[midIdx]}`;
    }

    return enrichedSentences.join(' ');
  });

  // Insert natural <breath> intakes between multi-paragraph transitions
  let wordsSinceBreath = 0;
  const finalParagraphs: string[] = [];

  for (let i = 0; i < processedParagraphs.length; i += 1) {
    let para = processedParagraphs[i];
    const hasBreathInside = /<breath>/i.test(para);

    if (i > 0 && !/^<breath>/i.test(para)) {
      const prevPara = finalParagraphs[i - 1] ?? '';
      const prevEndedWithBreath = /<breath>\s*$/i.test(prevPara);
      const isFinalParagraph = i === processedParagraphs.length - 1;
      const shouldAddBreath =
        !prevEndedWithBreath &&
        ((wordsSinceBreath >= 16) || (isFinalParagraph && wordsSinceBreath >= 10));

      if (shouldAddBreath && !hasBreathInside) {
        para = `<breath> ${para}`;
        wordsSinceBreath = 0;
      }
    }

    if (hasBreathInside) {
      wordsSinceBreath = 0;
    }
    wordsSinceBreath += countSpokenWords(para);
    finalParagraphs.push(para);
  }

  const preparedText = finalParagraphs.join('\n\n');
  const totalPausesCount = countOccurrences(preparedText, /\.\.\./g);
  const totalBreathsCount = countOccurrences(preparedText, /<breath>/gi);

  return {
    preparedText,
    autoPausesCount: Math.max(0, totalPausesCount - originalPauses),
    autoBreathsCount: Math.max(0, totalBreathsCount - originalBreaths),
    totalPausesCount,
    totalBreathsCount,
    changed: preparedText !== normalized,
  };
}

export function buildNaturalDeliveryStyle(
  baseStyle: string,
  autoProsody: boolean
): string {
  const clean = baseStyle.trim();
  if (!autoProsody) {
    return clean;
  }
  if (/breath|respiraci/i.test(clean) && /pausa/i.test(clean)) {
    return `${clean} Ejecutá las marcas <breath> como respiraciones breves y orgánicas antes de retomar la frase.`;
  }
  return `${clean} Mantené ritmo humano conversacional con micro-pausas en comas y puntos suspensivos (...), e inhalaciones suaves en <breath> sin leer de corrido.`;
}

export function tokenizeProsodyText(text: string): ProsodyToken[] {
  if (!text) {
    return [];
  }
  const tokens: ProsodyToken[] = [];
  const regex = /(\.\.\.|<breath>)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }
    const raw = match[0];
    if (raw === '...') {
      tokens.push({ type: 'pause', value: '···' });
    } else {
      tokens.push({ type: 'breath', value: 'respiro' });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}
