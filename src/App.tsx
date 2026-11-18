import { useEffect, useMemo, useRef, useState } from 'react';
import { ClaudeConnectPanel } from './components/ClaudeConnectPanel';
import { DirectionPanel } from './components/DirectionPanel';
import { HeaderBar } from './components/HeaderBar';
import { ScriptWorkspace } from './components/ScriptWorkspace';
import { StudioPlayer } from './components/StudioPlayer';
import type { GeneratedTake } from './types/studio';
import { createWavAudioAsset } from './utils/audioWaveform';
import {
  analyzeScript,
  validateTtsRequest,
  type VoiceName,
} from './utils/scriptAnalysis';
import type { StudioDraft } from './utils/scriptLibrary';
import {
  deleteTakeFromStorage,
  loadStudioDraft,
  loadTakesFromStorage,
  saveStudioDraft,
  saveTakeToStorage,
} from './utils/studioPersistence';

interface TtsApiResponse {
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
  sampleRate?: number;
  byteLength?: number;
  preparedText?: string;
  error?: string;
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function App() {
  const [draft, setDraft] = useState<StudioDraft>(() => loadStudioDraft());
  const [takes, setTakes] = useState<GeneratedTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingLabel, setGeneratingLabel] = useState<string>(
    'Generando audio...'
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    text?: string;
    style?: string;
    voiceName?: string;
  }>({});

  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    saveStudioDraft(draft);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    void loadTakesFromStorage().then((stored) => {
      if (cancelled || stored.length === 0) {
        return;
      }
      for (const take of stored) {
        objectUrlsRef.current.push(take.audioUrl);
      }
      setTakes(stored);
      setActiveTakeId((prev) => prev ?? stored[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const analysis = useMemo(
    () => analyzeScript(draft.scriptText),
    [draft.scriptText]
  );

  const activeTake = useMemo(
    () => takes.find((t) => t.id === activeTakeId) ?? takes[0] ?? null,
    [takes, activeTakeId]
  );

  const nextTakeNumber = () =>
    takes.reduce((max, t) => Math.max(max, t.takeNumber), 0) + 1;

  const handleGenerateAudio = async () => {
    const validation = validateTtsRequest({
      text: draft.scriptText,
      style: draft.stylePrompt,
      voiceName: draft.voiceName,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setApiError(null);
    setIsGenerating(true);
    setGeneratingLabel(
      `Optimizando ritmo y generando audio (${draft.voiceName})...`
    );

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: draft.scriptText,
          style: draft.stylePrompt,
          voiceName: draft.voiceName,
          autoProsody: true,
        }),
      });

      const payload = (await response.json()) as TtsApiResponse;
      if (!response.ok || !payload.audioBase64) {
        throw new Error(
          payload.error ||
            'No se pudo completar la síntesis de voz. Intentá nuevamente.'
        );
      }

      const asset = createWavAudioAsset(
        payload.audioBase64,
        payload.mimeType || 'audio/wav'
      );

      const takeNumber = nextTakeNumber();
      const newTake: GeneratedTake = {
        id: `${Date.now()}-${takeNumber}`,
        scriptId: 'draft',
        takeNumber,
        scopeLabel: 'Locución',
        blockIndex: null,
        text: payload.preparedText || draft.scriptText,
        style: draft.stylePrompt,
        voiceName: draft.voiceName,
        audioUrl: asset.url,
        wavBytes: asset.wavBytes,
        durationSeconds: payload.durationSeconds ?? 0,
        sampleRate: payload.sampleRate ?? 24000,
        byteLength: payload.byteLength ?? asset.byteLength,
        waveformPeaks: asset.peaks,
        createdAtLabel: nowTimeLabel(),
        isApproved: false,
        kind: 'full',
      };

      objectUrlsRef.current.push(newTake.audioUrl);
      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
      void saveTakeToStorage(newTake);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error inesperado al conectar con el servicio de voz.';
      setApiError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteTake = (takeId: string) => {
    setTakes((prev) => {
      const target = prev.find((t) => t.id === takeId);
      if (target) {
        URL.revokeObjectURL(target.audioUrl);
      }
      const next = prev.filter((t) => t.id !== takeId);
      if (activeTakeId === takeId) {
        setActiveTakeId(next[0]?.id ?? null);
      }
      return next;
    });
    void deleteTakeFromStorage(takeId);
  };

  return (
    <div id="top" className="min-h-screen bg-[#F7F7F5] text-[#141619]">
      <HeaderBar
        isGenerating={isGenerating}
        onGenerateFull={() => void handleGenerateAudio()}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#141619] text-balance sm:text-4xl">
            Locución natural en un clic
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-[#525866]">
            Escribí o pegá tu texto normal. Las pausas y respiraciones se
            agregan solas al generar el audio.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            <ScriptWorkspace
              scriptText={draft.scriptText}
              onChangeScript={(val) => {
                setDraft((prev) => ({ ...prev, scriptText: val }));
                if (validationErrors.text) {
                  setValidationErrors((prev) => ({ ...prev, text: undefined }));
                }
              }}
              onClearScript={() => {
                setDraft((prev) => ({ ...prev, scriptText: '' }));
                setValidationErrors({});
              }}
              analysis={analysis}
              validationError={validationErrors.text}
            />

            <DirectionPanel
              stylePrompt={draft.stylePrompt}
              onChangeStylePrompt={(val) => {
                setDraft((prev) => ({ ...prev, stylePrompt: val }));
                if (validationErrors.style) {
                  setValidationErrors((prev) => ({ ...prev, style: undefined }));
                }
              }}
              selectedVoice={draft.voiceName}
              onSelectVoice={(voice: VoiceName) =>
                setDraft((prev) => ({ ...prev, voiceName: voice }))
              }
              styleError={validationErrors.style}
            />

            <ClaudeConnectPanel
              selectedVoice={draft.voiceName}
              scriptText={draft.scriptText}
            />
          </div>

          <div className="lg:col-span-5">
            <StudioPlayer
              activeTake={activeTake}
              takes={takes}
              isGenerating={isGenerating}
              generatingLabel={generatingLabel}
              apiError={apiError}
              onSelectTake={(take) => setActiveTakeId(take.id)}
              onDeleteTake={handleDeleteTake}
              onGenerateFull={() => void handleGenerateAudio()}
            />
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-[#E4E4E0] bg-[#F7F7F5]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-[#525866] sm:px-6">
          <span>Mortups Locución</span>
          <span>Audio generado por Gemini 3.8 Flash TTS</span>
        </div>
      </footer>
    </div>
  );
}
