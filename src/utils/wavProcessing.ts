export interface PcmAudioData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcmBytes: Uint8Array;
}

export interface StitchedWavResult {
  wavBytes: Uint8Array;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
}

export function extractPcmFromWav(wavBytes: Uint8Array): PcmAudioData {
  if (wavBytes.length < 44) {
    throw new Error('Archivo WAV inválido o demasiado corto.');
  }

  const riff = String.fromCharCode(
    wavBytes[0],
    wavBytes[1],
    wavBytes[2],
    wavBytes[3]
  );
  const wave = String.fromCharCode(
    wavBytes[8],
    wavBytes[9],
    wavBytes[10],
    wavBytes[11]
  );

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Encabezado RIFF/WAVE inválido.');
  }

  const view = new DataView(
    wavBytes.buffer,
    wavBytes.byteOffset,
    wavBytes.byteLength
  );
  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 24000;
  const bitsPerSample = view.getUint16(34, true) || 16;

  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const chunkId = String.fromCharCode(
      wavBytes[offset],
      wavBytes[offset + 1],
      wavBytes[offset + 2],
      wavBytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      const start = offset + 8;
      const end = Math.min(wavBytes.length, start + chunkSize);
      return {
        sampleRate,
        channels,
        bitsPerSample,
        pcmBytes: wavBytes.slice(start, end),
      };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return {
    sampleRate,
    channels,
    bitsPerSample,
    pcmBytes: wavBytes.slice(44),
  };
}

export function createSilencePcm(
  durationMs: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Uint8Array {
  if (durationMs <= 0) {
    return new Uint8Array(0);
  }
  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const frameCount = Math.round((durationMs / 1000) * sampleRate);
  return new Uint8Array(frameCount * channels * bytesPerSample);
}

export function buildWavFromPcm(params: {
  pcmBytes: Uint8Array;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}): Uint8Array {
  const { pcmBytes, sampleRate, channels, bitsPerSample } = params;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(buffer.buffer);

  buffer.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  view.setUint32(4, 36 + pcmBytes.length, true);
  buffer.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt 
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  buffer.set([0x64, 0x61, 0x74, 0x61], 36); // data
  view.setUint32(40, pcmBytes.length, true);
  buffer.set(pcmBytes, 44);

  return buffer;
}

export function encodeFloat32ToWav(
  channelData: Float32Array[],
  sampleRate: number
): StitchedWavResult {
  const channels = Math.max(1, channelData.length);
  const frameCount = channelData[0]?.length ?? 0;
  const pcmBytes = new Uint8Array(frameCount * channels * 2);
  const view = new DataView(pcmBytes.buffer);

  let writeOffset = 0;
  for (let i = 0; i < frameCount; i += 1) {
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = channelData[ch]?.[i] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(writeOffset, Math.round(int16), true);
      writeOffset += 2;
    }
  }

  const wavBytes = buildWavFromPcm({
    pcmBytes,
    sampleRate,
    channels,
    bitsPerSample: 16,
  });

  return {
    wavBytes,
    durationSeconds: sampleRate > 0 ? frameCount / sampleRate : 0,
    sampleRate,
    byteLength: wavBytes.length,
  };
}

export function stitchWavSegments(
  segments: Uint8Array[],
  gapMs = 300
): StitchedWavResult {
  if (segments.length === 0) {
    throw new Error('Se necesita al menos un bloque de audio para ensamblar.');
  }

  const parsed = segments.map(extractPcmFromWav);
  const base = parsed[0];
  const silence = createSilencePcm(
    gapMs,
    base.sampleRate,
    base.channels,
    base.bitsPerSample
  );

  const chunks: Uint8Array[] = [];
  let totalPcmBytes = 0;

  for (let i = 0; i < parsed.length; i += 1) {
    const item = parsed[i];
    if (
      item.sampleRate !== base.sampleRate ||
      item.channels !== base.channels ||
      item.bitsPerSample !== base.bitsPerSample
    ) {
      throw new Error(
        'Todos los bloques deben tener la misma frecuencia y formato PCM.'
      );
    }
    chunks.push(item.pcmBytes);
    totalPcmBytes += item.pcmBytes.length;

    if (i < parsed.length - 1 && silence.length > 0) {
      chunks.push(silence);
      totalPcmBytes += silence.length;
    }
  }

  const mergedPcm = new Uint8Array(totalPcmBytes);
  let cursor = 0;
  for (const chunk of chunks) {
    mergedPcm.set(chunk, cursor);
    cursor += chunk.length;
  }

  const wavBytes = buildWavFromPcm({
    pcmBytes: mergedPcm,
    sampleRate: base.sampleRate,
    channels: base.channels,
    bitsPerSample: base.bitsPerSample,
  });

  const byteRate = base.sampleRate * base.channels * (base.bitsPerSample / 8);
  const durationSeconds = byteRate > 0 ? totalPcmBytes / byteRate : 0;

  return {
    wavBytes,
    durationSeconds,
    sampleRate: base.sampleRate,
    byteLength: wavBytes.length,
  };
}
