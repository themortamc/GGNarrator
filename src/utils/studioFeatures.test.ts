import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeProsody,
  buildNaturalDeliveryStyle,
  tokenizeProsodyText,
} from './prosodyAnalyzer';
import { createEmptyDraft } from './scriptLibrary';
import {
  formatSrtTimestamp,
  generateSrtCues,
  serializeSrt,
} from './srtGenerator';
import {
  buildWavFromPcm,
  encodeFloat32ToWav,
  extractPcmFromWav,
  stitchWavSegments,
} from './wavProcessing';

test('createEmptyDraft initializes with empty text and autoProsody enabled', () => {
  const draft = createEmptyDraft();
  assert.equal(draft.scriptText, '');
  assert.equal(draft.voiceName, 'Puck');
  assert.equal(draft.autoProsody, true);
});

test('stitchWavSegments joins multiple WAVs with configured silence gap', () => {
  const oneHalfSecFrames = 12000;
  const pcmA = new Uint8Array(oneHalfSecFrames * 2).fill(1);
  const pcmB = new Uint8Array(oneHalfSecFrames * 2).fill(2);

  const wavA = buildWavFromPcm({
    pcmBytes: pcmA,
    sampleRate: 24000,
    channels: 1,
    bitsPerSample: 16,
  });
  const wavB = buildWavFromPcm({
    pcmBytes: pcmB,
    sampleRate: 24000,
    channels: 1,
    bitsPerSample: 16,
  });

  const stitched = stitchWavSegments([wavA, wavB], 500);
  const parsed = extractPcmFromWav(stitched.wavBytes);

  assert.equal(parsed.sampleRate, 24000);
  assert.equal(parsed.pcmBytes.length, 72000);
  assert.equal(Number(stitched.durationSeconds.toFixed(2)), 1.5);
});

test('encodeFloat32ToWav writes valid 16-bit PCM WAV header and frames', () => {
  const mono = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const encoded = encodeFloat32ToWav([mono], 24000);
  const parsed = extractPcmFromWav(encoded.wavBytes);
  assert.equal(parsed.sampleRate, 24000);
  assert.equal(parsed.channels, 1);
  assert.equal(parsed.pcmBytes.length, 10);
});

test('generateSrtCues produces sequential timestamps covering full duration', () => {
  const cues = generateSrtCues(
    'Hola a todos... bienvenidos hoy. Empecemos ahora.',
    10
  );
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startSeconds, 0);
  assert.equal(cues[1].endSeconds, 10);
  const srt = serializeSrt(cues);
  assert.match(srt, /00:00:00,000 --> /);
  assert.match(srt, /--> 00:00:10,000/);
  assert.equal(formatSrtTimestamp(65.25), '00:01:05,250');
});

test('analyzeProsody automatically inserts pauses and breaths into plain Spanish text', () => {
  const plainScript = [
    'Tener una página web linda ya no alcanza. Si entran visitas y nadie te escribe, estás perdiendo clientes todos los días.',
    'En nuestro estudio diseñamos sitios web rápidos pensados para una sola cosa: convertir visitas en consultas reales.',
    '¿Querés empezar hoy mismo? Escribinos ahora y hagamos crecer tu proyecto.',
  ].join('\n\n');

  const res = analyzeProsody(plainScript);
  assert.equal(res.changed, true);
  assert.ok(res.autoPausesCount >= 2, 'should add natural ... pauses');
  assert.ok(res.autoBreathsCount >= 1, 'should add natural <breath> intakes');
  assert.match(res.preparedText, /\.\.\./);
  assert.match(res.preparedText, /<breath>/);

  const tokens = tokenizeProsodyText(res.preparedText);
  assert.ok(tokens.some((t) => t.type === 'pause'));
  assert.ok(tokens.some((t) => t.type === 'breath'));
});

test('analyzeProsody handles single long plain paragraph and avoids duplicating existing cues', () => {
  const singleParagraph =
    'Si querés vender más por internet pero tu sitio actual tarda en cargar, perdés consultas valiosas todos los días. Armamos páginas rápidas con seguimiento real de conversiones. Escribinos hoy para empezar tu campaña.';
  const res = analyzeProsody(singleParagraph);
  assert.ok(res.autoPausesCount >= 1);
  assert.ok(res.autoBreathsCount >= 1);

  const alreadyAnnotated =
    'Hola... <breath> este texto ya tiene su pausa definida.';
  const preserved = analyzeProsody(alreadyAnnotated);
  assert.equal(preserved.autoPausesCount, 0);
  assert.equal(preserved.autoBreathsCount, 0);

  const enrichedStyle = buildNaturalDeliveryStyle('Locutor cercano.', true);
  assert.match(enrichedStyle, /<breath>/);
});
