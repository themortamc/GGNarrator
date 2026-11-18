import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAutoProsodyText } from './prosodyService.ts';

test('prepareAutoProsodyText applies AI-enriched rhythm when available and coherent', async () => {
  const plain =
    'Si entran visitas a tu sitio y nadie te escribe, estás perdiendo oportunidades reales todos los días. Escribinos hoy y ordenemos tu presencia digital.';

  const res = await prepareAutoProsodyText({
    text: plain,
    style: 'Comercial cercano',
    analyzeWithAi: async () => ({
      annotatedText:
        'Si entran visitas a tu sitio y nadie te escribe... estás perdiendo oportunidades reales todos los días.\n\n<breath> Escribinos hoy... y ordenemos tu presencia digital.',
      notes: 'Pausas y respiración aplicadas.',
      model: 'mock-ai',
    }),
  });

  assert.equal(res.usedAi, true);
  assert.match(res.preparedText, /\.\.\./);
  assert.match(res.preparedText, /<breath>/);
  assert.ok(res.autoPausesCount >= 2);
  assert.ok(res.autoBreathsCount >= 1);
});

test('prepareAutoProsodyText falls back cleanly to local prosody when AI fails or times out', async () => {
  const plain =
    'Si querés vender más por internet pero tu sitio actual tarda en cargar, perdés consultas valiosas todos los días. Armamos páginas rápidas con seguimiento real de conversiones. Escribinos hoy para empezar tu campaña.';

  const res = await prepareAutoProsodyText({
    text: plain,
    analyzeWithAi: async () => {
      throw new Error('503 UNAVAILABLE');
    },
  });

  assert.equal(res.usedAi, false);
  assert.ok(res.autoPausesCount >= 1);
  assert.ok(res.autoBreathsCount >= 1);
  assert.match(res.preparedText, /\.\.\./);
});

test('prepareAutoProsodyText rejects corrupted AI output and falls back safely', async () => {
  const plain =
    'Si querés vender más por internet pero tu sitio actual tarda en cargar, perdés consultas valiosas todos los días. Armamos páginas rápidas con seguimiento real de conversiones.';

  const res = await prepareAutoProsodyText({
    text: plain,
    analyzeWithAi: async () => ({
      annotatedText: 'Hola.',
      notes: 'Demasiado corto.',
      model: 'mock-ai',
    }),
  });

  assert.equal(res.usedAi, false);
  assert.ok(res.preparedText.includes('Armamos páginas rápidas'));
});
