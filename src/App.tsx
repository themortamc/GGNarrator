import { useEffect, useMemo, useRef, useState } from 'react';
import { ClaudeConnectPanel } from './components/ClaudeConnectPanel';
import { DirectionPanel } from './components/DirectionPanel';
import { HeaderBar } from './components/HeaderBar';
import { ScriptWorkspace } from './components/ScriptWorkspace';
import { StudioPlayer } from './components/StudioPlayer';
import type { GeneratedTake } from './types/studio';
import { createWavAudioAsset } from './utils/audioWaveform';
import {
  DEFAULT_MORTUPS_SCRIPT,
  DEFAULT_VOICE_STYLE,
  analyzeScript,
  validateTtsRequest,
  type ScriptBlock,
  type VoiceName,
} from './utils/scriptAnalysis';

interface TtsApiResponse {
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
  sampleRate?: number;
  byteLength?: number;
  error?: string;
}

export default function App() {
  const [scriptText, setScriptText] = useState<string>(DEFAULT_MORTUPS_SCRIPT);
  const [stylePrompt, setStylePrompt] = useState<string>(DEFAULT_VOICE_STYLE);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Puck');

  const [takes, setTakes] = useState<GeneratedTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingLabel, setGeneratingLabel] = useState<string>(
    'Generando locución completa'
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    text?: string;
    style?: string;
    voiceName?: string;
  }>({});

  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const analysis = useMemo(() => analyzeScript(scriptText), [scriptText]);

  const isDefaultState =
    scriptText === DEFAULT_MORTUPS_SCRIPT &&
    stylePrompt === DEFAULT_VOICE_STYLE;

  const activeTake = useMemo(
    () => takes.find((t) => t.id === activeTakeId) ?? takes[0] ?? null,
    [takes, activeTakeId]
  );

  const handleResetDefault = () => {
    setScriptText(DEFAULT_MORTUPS_SCRIPT);
    setStylePrompt(DEFAULT_VOICE_STYLE);
    setValidationErrors({});
    setApiError(null);
  };

  const synthesizeSpeech = async (textToRead: string, scopeLabel: string) => {
    const validation = validateTtsRequest({
      text: textToRead,
      style: stylePrompt,
      voiceName: selectedVoice,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setApiError(null);
    setIsGenerating(true);
    setGeneratingLabel(`Generando ${scopeLabel.toLowerCase()} (${selectedVoice})`);

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToRead,
          style: stylePrompt,
          voiceName: selectedVoice,
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
      objectUrlsRef.current.push(asset.url);

      const now = new Date();
      const timeLabel = now.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      setTakes((prev) => {
        const nextNumber = prev.length + 1;
        const newTake: GeneratedTake = {
          id: `${Date.now()}-${nextNumber}`,
          takeNumber: nextNumber,
          scopeLabel,
          text: textToRead,
          style: stylePrompt,
          voiceName: selectedVoice,
          audioUrl: asset.url,
          durationSeconds: payload.durationSeconds ?? 0,
          sampleRate: payload.sampleRate ?? 24000,
          byteLength: payload.byteLength ?? asset.byteLength,
          waveformPeaks: asset.peaks,
          createdAtLabel: timeLabel,
        };
        setActiveTakeId(newTake.id);
        return [newTake, ...prev];
      });
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

  const handleGenerateFull = () => {
    void synthesizeSpeech(scriptText, 'Spot completo');
  };

  const handleGenerateBlock = (block: ScriptBlock) => {
    void synthesizeSpeech(block.text, block.label);
  };

  return (
    <div id="top" className="min-h-screen bg-[#F7F7F5] text-[#141619]">
      <HeaderBar
        isGenerating={isGenerating}
        onGenerateFull={handleGenerateFull}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-[#525866]">
            Spot comercial Mortups · Español rioplatense neutro · Gemini 3.8
            Flash TTS
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#141619] text-balance sm:text-4xl">
            Locución comercial con pausas naturales y cierre firme
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#525866]">
            Ajustá el guion, verificá los puntos suspensivos de respiración y
            generá tomas en audio WAV listas para editar o publicar.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7">
            <ScriptWorkspace
              scriptText={scriptText}
              onChangeScript={(val) => {
                setScriptText(val);
                if (validationErrors.text) {
                  setValidationErrors((prev) => ({ ...prev, text: undefined }));
                }
              }}
              onResetDefault={handleResetDefault}
              isDefaultScript={isDefaultState}
              analysis={analysis}
              validationError={validationErrors.text}
              isGenerating={isGenerating}
              onGenerateBlock={handleGenerateBlock}
            />

            <DirectionPanel
              stylePrompt={stylePrompt}
              onChangeStylePrompt={(val) => {
                setStylePrompt(val);
                if (validationErrors.style) {
                  setValidationErrors((prev) => ({
                    ...prev,
                    style: undefined,
                  }));
                }
              }}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              styleError={validationErrors.style}
            />

            <ClaudeConnectPanel
              selectedVoice={selectedVoice}
              scriptText={scriptText}
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
              onGenerateFull={handleGenerateFull}
            />
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-[#E4E4E0] bg-[#F7F7F5]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-[#525866] sm:px-6">
          <span>Mortups Locución Comercial</span>
          <span>Audio generado por Gemini 3.8 Flash TTS</span>
        </div>
      </footer>
    </div>
  );
}
