export interface SrtCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMillis = Math.round(safe * 1000);
  const hours = Math.floor(totalMillis / 3600000);
  const mins = Math.floor((totalMillis % 3600000) / 60000);
  const secs = Math.floor((totalMillis % 60000) / 1000);
  const ms = totalMillis % 1000;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function splitTextIntoCaptionLines(rawText: string): string[] {
  const cleaned = rawText
    .replace(/<breath>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return [];
  }

  // Split by sentence punctuation (excluding ... ellipsis) while preserving punctuation
  const sentenceParts = cleaned
    .split(/(?<!\.\.)(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const captions: string[] = [];
  for (const sentence of sentenceParts) {
    const words = sentence.split(/\s+/);
    if (words.length <= 10) {
      captions.push(sentence);
      continue;
    }

    // Split longer sentences into ~8-word readable subtitle chunks
    let current: string[] = [];
    for (const word of words) {
      current.push(word);
      const endsOnClause = /[,:;]$/.test(word) && current.length >= 4;
      if (current.length >= 8 || endsOnClause) {
        captions.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) {
      captions.push(current.join(' '));
    }
  }

  return captions;
}

export function generateSrtCues(
  text: string,
  totalDurationSeconds: number
): SrtCue[] {
  const segments = splitTextIntoCaptionLines(text);
  if (segments.length === 0 || totalDurationSeconds <= 0) {
    return [];
  }

  const weights = segments.map((seg) => {
    const charWeight = seg.replace(/\.\.\./g, '').length;
    const ellipsisBonus = (seg.match(/\.\.\./g) ?? []).length * 10;
    return Math.max(8, charWeight + ellipsisBonus);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const cues: SrtCue[] = [];
  let cursor = 0;

  for (let i = 0; i < segments.length; i += 1) {
    const ratio = weights[i] / totalWeight;
    const isLast = i === segments.length - 1;
    const end = isLast
      ? totalDurationSeconds
      : Math.min(totalDurationSeconds, cursor + ratio * totalDurationSeconds);

    cues.push({
      index: i + 1,
      startSeconds: cursor,
      endSeconds: Math.max(cursor + 0.1, end),
      text: segments[i],
    });
    cursor = end;
  }

  return cues;
}

export function serializeSrt(cues: SrtCue[]): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${formatSrtTimestamp(cue.startSeconds)} --> ${formatSrtTimestamp(cue.endSeconds)}\n${cue.text}`
    )
    .join('\n\n');
}
