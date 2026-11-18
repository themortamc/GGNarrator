import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MORTUPS_SCRIPT,
  DEFAULT_VOICE_STYLE,
  analyzeScript,
  formatDuration,
  parseWavMetadata,
  validateTtsRequest,
} from './scriptAnalysis';

test('default Mortups script preserves 4 paragraphs and 3 ellipsis pauses', () => {
  const analysis = analyzeScript(DEFAULT_MORTUPS_SCRIPT);
  assert.equal(analysis.paragraphCount, 4);
  assert.equal(analysis.ellipsisCount, 3);
  assert.equal(analysis.questionCount, 1);
  assert.ok(analysis.wordCount > 70);
  assert.ok(analysis.estimatedDurationSeconds >= 25);
  assert.equal(analysis.blocks[0]?.label, '01. Gancho inicial');
  assert.equal(analysis.blocks[3]?.label, '04. Cierre y llamado');
});

test('analyzeScript handles empty input gracefully', () => {
  const analysis = analyzeScript('   \n\n  ');
  assert.equal(analysis.paragraphCount, 0);
  assert.equal(analysis.wordCount, 0);
  assert.equal(analysis.estimatedDurationSeconds, 0);
  assert.deepEqual(analysis.blocks, []);
});

test('validateTtsRequest rejects empty script and invalid voice', () => {
  const invalid = validateTtsRequest({
    text: '   ',
    style: DEFAULT_VOICE_STYLE,
    voiceName: 'UnknownVoice',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.text);
  assert.ok(invalid.errors.voiceName);

  const valid = validateTtsRequest({
    text: DEFAULT_MORTUPS_SCRIPT,
    style: DEFAULT_VOICE_STYLE,
    voiceName: 'Puck',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('formatDuration formats seconds as m:ss', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(9), '0:09');
  assert.equal(formatDuration(36.4), '0:36');
  assert.equal(formatDuration(65), '1:05');
});

test('parseWavMetadata extracts sample rate and exact duration from RIFF header', () => {
  // Build a minimal 1-second 24kHz mono 16-bit PCM WAV header + payload size
  const sampleRate = 24000;
  const dataBytes = 48000; // 1.0 second at 24kHz * 2 bytes
  const buffer = new Uint8Array(44 + dataBytes);
  const view = new DataView(buffer.buffer);

  // "RIFF"
  buffer.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataBytes, true);
  // "WAVE"
  buffer.set([0x57, 0x41, 0x56, 0x45], 8);
  // "fmt "
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byteRate
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // "data"
  buffer.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataBytes, true);

  const meta = parseWavMetadata(buffer);
  assert.equal(meta.sampleRate, 24000);
  assert.equal(meta.channels, 1);
  assert.equal(meta.bitsPerSample, 16);
  assert.equal(meta.dataBytes, 48000);
  assert.equal(meta.durationSeconds, 1);
});
