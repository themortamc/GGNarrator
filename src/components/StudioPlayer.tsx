import {
  AlertCircle,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GeneratedTake } from '../types/studio';
import { formatDuration } from '../utils/scriptAnalysis';

interface StudioPlayerProps {
  activeTake: GeneratedTake | null;
  takes: GeneratedTake[];
  isGenerating: boolean;
  generatingLabel: string;
  apiError: string | null;
  onSelectTake: (take: GeneratedTake) => void;
  onGenerateFull: () => void;
}

const IDLE_BARS = Array.from({ length: 56 }, (_, i) => {
  const wave = Math.sin(i * 0.45) * 0.12 + Math.cos(i * 0.22) * 0.08;
  return Number(Math.max(0.14, 0.24 + wave).toFixed(3));
});

const PLAYBACK_RATES = [0.9, 1.0, 1.1] as const;

export function StudioPlayer({
  activeTake,
  takes,
  isGenerating,
  generatingLabel,
  apiError,
  onSelectTake,
  onGenerateFull,
}: StudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(activeTake?.durationSeconds ?? 0);
    if (audio && activeTake) {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = playbackRate;
    }
  }, [activeTake?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !activeTake) {
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleRestart = async () => {
    const audio = audioRef.current;
    if (!audio || !activeTake) {
      return;
    }
    audio.currentTime = 0;
    setCurrentTime(0);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const effectiveDuration = duration || activeTake?.durationSeconds || 0;
  const progressRatio =
    effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;
  const peaks = activeTake?.waveformPeaks ?? IDLE_BARS;

  return (
    <aside className="space-y-6 lg:sticky lg:top-24">
      <section
        aria-labelledby="monitor-heading"
        className="rounded-xl border border-[#E4E4E0] bg-white p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="monitor-heading"
              className="font-display text-xl font-semibold tracking-tight text-[#141619]"
            >
              Monitor de locución
            </h2>
            {activeTake ? (
              <p className="mt-1 text-xs text-[#525866] tabular-nums">
                <span>Toma #{activeTake.takeNumber}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>{activeTake.scopeLabel}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>{activeTake.voiceName}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>{Math.round(activeTake.sampleRate / 1000)} kHz WAV</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#525866]">
                Salida WAV 24 kHz mono vía gemini-3.8-flash-tts
              </p>
            )}
          </div>
        </div>

        {apiError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#F2C6C6] bg-[#FDF4F4] p-3.5 text-xs leading-relaxed text-[#9C1F1F]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{apiError}</p>
            </div>
          </div>
        ) : null}

        {isGenerating ? (
          <div
            aria-live="polite"
            className="mt-5 rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] p-5"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#141619]">
              <Loader2
                className="h-4 w-4 animate-spin text-[#D94E28]"
                aria-hidden="true"
              />
              <span>{generatingLabel}</span>
            </div>
            <p className="mt-2 text-xs text-[#525866]">
              Sintetizando pausas respiratorias e intención rioplatense en el
              servidor...
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-[#ECECE8] bg-[#FAFAF8] p-4">
          <div className="relative flex h-20 items-center">
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center gap-[3px]"
            >
              {peaks.map((peak, index) => {
                const barRatio = (index + 1) / peaks.length;
                const isPlayed = activeTake ? barRatio <= progressRatio : false;
                return (
                  <span
                    key={index}
                    className={`block flex-1 rounded-full transition-colors ${
                      !activeTake
                        ? 'bg-[#D8D7D2]'
                        : isPlayed
                          ? 'bg-[#D94E28]'
                          : 'bg-[#C8C7C0]'
                    }`}
                    style={{ height: `${Math.round(peak * 100)}%` }}
                  />
                );
              })}
            </div>
            {activeTake ? (
              <input
                type="range"
                min={0}
                max={effectiveDuration > 0 ? effectiveDuration : 1}
                step={0.05}
                value={Math.min(currentTime, effectiveDuration || 1)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = next;
                  }
                  setCurrentTime(next);
                }}
                aria-label="Posición de reproducción"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E5E0] pt-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!activeTake}
                aria-label={isPlaying ? 'Pausar locución' : 'Reproducir locución'}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#141619] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2A2D33] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                disabled={!activeTake}
                aria-label="Reiniciar reproducción"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E4E0] bg-white text-[#141619] transition-colors hover:bg-[#F0F0EC] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center rounded-lg border border-[#E4E4E0] bg-white p-0.5"
                role="group"
                aria-label="Velocidad de reproducción"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    disabled={!activeTake}
                    onClick={() => setPlaybackRate(rate)}
                    aria-pressed={playbackRate === rate}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium transition-colors disabled:opacity-40 ${
                      playbackRate === rate
                        ? 'bg-[#141619] text-white'
                        : 'text-[#525866] hover:text-[#141619]'
                    }`}
                  >
                    {rate.toFixed(1)}x
                  </button>
                ))}
              </div>

              <span className="font-mono text-xs font-medium text-[#141619] tabular-nums">
                {formatDuration(currentTime)} / {formatDuration(effectiveDuration)}
              </span>
            </div>
          </div>
        </div>

        {activeTake ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#525866] tabular-nums">
              Archivo listo · {Math.max(1, Math.round(activeTake.byteLength / 1024))} KB
            </span>
            <a
              href={activeTake.audioUrl}
              download={`mortups-toma-${activeTake.takeNumber}-${activeTake.voiceName.toLowerCase()}.wav`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Descargar WAV</span>
            </a>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#525866]">
              Todavía no generaste ninguna toma en esta sesión.
            </p>
            <button
              type="button"
              onClick={onGenerateFull}
              disabled={isGenerating}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Generar primera toma</span>
            </button>
          </div>
        )}

        <audio
          ref={audioRef}
          src={activeTake?.audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration)) {
              setDuration(e.currentTarget.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          className="sr-only"
        />
      </section>

      <section
        id="tomas"
        aria-labelledby="tomas-heading"
        className="rounded-xl border border-[#E4E4E0] bg-white p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="tomas-heading"
            className="font-display text-lg font-semibold tracking-tight text-[#141619]"
          >
            Tomas generadas
          </h2>
          <span className="font-mono text-xs text-[#525866] tabular-nums">
            {takes.length} {takes.length === 1 ? 'toma' : 'tomas'}
          </span>
        </div>

        {takes.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-[#525866]">
            Cada toma generada queda disponible acá para comparar voces,
            ritmos y descargar el WAV sin sobrescribir las anteriores.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#ECECE8] border-t border-[#ECECE8]">
            {takes.map((take) => {
              const isSelected = activeTake?.id === take.id;
              return (
                <li
                  key={take.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTake(take)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[#141619]">
                      <span
                        className={isSelected ? 'text-[#D94E28]' : 'text-[#141619]'}
                      >
                        Toma #{take.takeNumber}
                      </span>
                      <span className="truncate text-xs font-normal text-[#525866]">
                        {take.scopeLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#525866] tabular-nums">
                      <span>{take.voiceName}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span>{formatDuration(take.durationSeconds)}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span>{take.createdAtLabel}</span>
                    </p>
                  </button>

                  <a
                    href={take.audioUrl}
                    download={`mortups-toma-${take.takeNumber}-${take.voiceName.toLowerCase()}.wav`}
                    aria-label={`Descargar Toma #${take.takeNumber}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E0] bg-white text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
