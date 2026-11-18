import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeneratedTake } from '../types/studio';
import { formatDuration } from '../utils/scriptAnalysis';
import { generateSrtCues, serializeSrt } from '../utils/srtGenerator';

interface StudioPlayerProps {
  activeTake: GeneratedTake | null;
  takes: GeneratedTake[];
  isGenerating: boolean;
  generatingLabel: string;
  apiError: string | null;
  onSelectTake: (take: GeneratedTake) => void;
  onDeleteTake: (takeId: string) => void;
  onGenerateFull: () => void;
}

const IDLE_BARS = Array.from({ length: 48 }, (_, i) => {
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
  onDeleteTake,
  onGenerateFull,
}: StudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showSrtPreview, setShowSrtPreview] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(activeTake?.durationSeconds ?? 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
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
  const peaks = activeTake?.waveformPeaks.slice(0, 48) ?? IDLE_BARS;

  const srtContent = useMemo(() => {
    if (!activeTake || effectiveDuration <= 0) {
      return '';
    }
    return serializeSrt(generateSrtCues(activeTake.text, effectiveDuration));
  }, [activeTake, effectiveDuration]);

  const handleDownloadSrt = () => {
    if (!activeTake || !srtContent) {
      return;
    }
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locucion-toma-${activeTake.takeNumber}-${activeTake.voiceName.toLowerCase()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="space-y-6 lg:sticky lg:top-24">
      <section
        aria-labelledby="monitor-heading"
        className="rounded-xl border border-[#E4E4E0] bg-white p-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2
              id="monitor-heading"
              className="font-display text-lg font-semibold tracking-tight text-[#141619]"
            >
              Reproductor
            </h2>
            {activeTake ? (
              <p className="mt-0.5 text-xs text-[#525866] tabular-nums">
                <span>Toma #{activeTake.takeNumber}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>{activeTake.voiceName}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>
                  {Math.max(1, Math.round(activeTake.byteLength / 1024))} KB WAV
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#525866]">
                Audio WAV 24 kHz listo para descargar
              </p>
            )}
          </div>
        </div>

        {apiError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#F2C6C6] bg-[#FDF4F4] p-3 text-xs leading-relaxed text-[#9C1F1F]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 font-medium">{apiError}</p>
          </div>
        ) : null}

        {isGenerating ? (
          <div
            aria-live="polite"
            className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] p-4 text-xs font-medium text-[#141619]"
          >
            <Loader2
              className="h-4 w-4 animate-spin text-[#D94E28] shrink-0"
              aria-hidden="true"
            />
            <span>{generatingLabel}</span>
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-[#ECECE8] bg-[#FAFAF8] p-4">
          <div className="relative flex h-16 items-center">
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

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6E5E0] pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!activeTake}
                aria-label={isPlaying ? 'Pausar locución' : 'Reproducir locución'}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#141619] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2A2D33] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E4E0] bg-white text-[#141619] transition-colors hover:bg-[#F0F0EC] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
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
          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={activeTake.audioUrl}
                  download={`locucion-toma-${activeTake.takeNumber}-${activeTake.voiceName.toLowerCase()}.wav`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#141619] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2A2D33] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Descargar WAV</span>
                </a>

                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Descargar .SRT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSrtPreview((prev) => !prev)}
                className="text-xs font-medium text-[#525866] underline-offset-4 hover:text-[#141619] hover:underline"
              >
                {showSrtPreview ? 'Ocultar .SRT' : 'Ver .SRT'}
              </button>
            </div>

            {showSrtPreview && srtContent ? (
              <pre className="max-h-44 overflow-y-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] p-3 font-mono text-[11px] leading-relaxed text-[#141619] whitespace-pre-wrap">
                {srtContent}
              </pre>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#525866]">
              Escribí tu texto a la izquierda y presioná Generar audio.
            </p>
            <button
              type="button"
              onClick={onGenerateFull}
              disabled={isGenerating}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Generar audio</span>
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

      {takes.length > 0 ? (
        <section
          id="tomas"
          aria-labelledby="tomas-heading"
          className="rounded-xl border border-[#E4E4E0] bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2
              id="tomas-heading"
              className="font-display text-base font-semibold tracking-tight text-[#141619]"
            >
              Historial de tomas
            </h2>
            <span className="font-mono text-xs text-[#525866] tabular-nums">
              {takes.length} {takes.length === 1 ? 'toma' : 'tomas'}
            </span>
          </div>

          <ul className="mt-3 divide-y divide-[#ECECE8] border-t border-[#ECECE8]">
            {takes.map((take) => {
              const isSelected = activeTake?.id === take.id;
              return (
                <li
                  key={take.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTake(take)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={isSelected ? 'text-[#D94E28]' : 'text-[#141619]'}
                      >
                        Toma #{take.takeNumber}
                      </span>
                      <span className="text-xs font-normal text-[#525866] tabular-nums">
                        {take.voiceName} · {formatDuration(take.durationSeconds)} ·{' '}
                        {take.createdAtLabel}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={take.audioUrl}
                      download={`locucion-toma-${take.takeNumber}-${take.voiceName.toLowerCase()}.wav`}
                      aria-label={`Descargar Toma #${take.takeNumber}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E0] bg-white text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onDeleteTake(take.id)}
                      aria-label={`Eliminar Toma #${take.takeNumber}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E4E4E0] bg-white text-[#525866] transition-colors hover:border-[#C92A2A] hover:text-[#C92A2A]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
