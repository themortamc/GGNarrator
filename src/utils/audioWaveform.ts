export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function extractWaveformPeaksFromWavBytes(
  bytes: Uint8Array,
  barCount = 56
): number[] {
  const headerSize = 44;
  if (bytes.length <= headerSize + 4) {
    return Array.from({ length: barCount }, () => 0.16);
  }

  const sampleCount = Math.floor((bytes.length - headerSize) / 2);
  if (sampleCount <= 0) {
    return Array.from({ length: barCount }, () => 0.16);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samplesPerBar = Math.max(1, Math.floor(sampleCount / barCount));
  const rawPeaks: number[] = [];

  for (let bar = 0; bar < barCount; bar += 1) {
    const startSample = bar * samplesPerBar;
    const endSample = Math.min(sampleCount, startSample + samplesPerBar);
    // Stride to keep waveform extraction instant even on long clips
    const step = Math.max(1, Math.floor((endSample - startSample) / 64));
    let maxAmp = 0;

    for (let s = startSample; s < endSample; s += step) {
      const byteOffset = headerSize + s * 2;
      if (byteOffset + 1 < bytes.length) {
        const sample = view.getInt16(byteOffset, true);
        const norm = Math.abs(sample) / 32768;
        if (norm > maxAmp) {
          maxAmp = norm;
        }
      }
    }
    rawPeaks.push(maxAmp);
  }

  const maxPeak = Math.max(...rawPeaks, 0.05);
  return rawPeaks.map((p) => {
    const normalized = Math.min(1, p / maxPeak);
    return Number(Math.max(0.14, normalized).toFixed(3));
  });
}

export function createWavAudioAsset(
  base64: string,
  mimeType = 'audio/wav'
): {
  url: string;
  byteLength: number;
  peaks: number[];
} {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const peaks = extractWaveformPeaksFromWavBytes(bytes, 56);
  return {
    url,
    byteLength: bytes.length,
    peaks,
  };
}
