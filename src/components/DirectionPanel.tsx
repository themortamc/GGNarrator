import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  STYLE_PRESETS,
  VOICE_OPTIONS,
  type VoiceName,
} from '../utils/scriptAnalysis';

interface DirectionPanelProps {
  stylePrompt: string;
  onChangeStylePrompt: (value: string) => void;
  selectedVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  styleError?: string;
}

export function DirectionPanel({
  stylePrompt,
  onChangeStylePrompt,
  selectedVoice,
  onSelectVoice,
  styleError,
}: DirectionPanelProps) {
  const [showCustomStyle, setShowCustomStyle] = useState(false);

  const selectedVoiceOption = VOICE_OPTIONS.find(
    (voice) => voice.id === selectedVoice
  );

  return (
    <section
      id="voz"
      aria-labelledby="voz-heading"
      className="rounded-xl border border-[#E4E4E0] bg-white p-5 sm:p-6"
    >
      <h2
        id="voz-heading"
        className="font-display text-lg font-semibold tracking-tight text-[#141619]"
      >
        Voz y estilo
      </h2>

      <div className="mt-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-[#525866]">Voz</span>
          {selectedVoiceOption ? (
            <span className="text-xs text-[#525866]">
              {selectedVoiceOption.profile}
            </span>
          ) : null}
        </div>
        <div
          role="radiogroup"
          aria-label="Selección de voz"
          className="mt-2 flex flex-wrap gap-2"
        >
          {VOICE_OPTIONS.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            return (
              <button
                key={voice.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                title={voice.profile}
                onClick={() => onSelectVoice(voice.id)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] ${
                  isSelected
                    ? 'border-[#D94E28] bg-[#FDF4F1] text-[#B33917]'
                    : 'border-[#E4E4E0] bg-[#FAFAF8] text-[#141619] hover:border-[#C9C8C2]'
                }`}
              >
                <span>{voice.label}</span>
                {voice.recommended ? (
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected ? 'text-[#B33917]' : 'text-[#525866]'
                    }`}
                  >
                    · Sugerida
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-[#ECECE8] pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#525866]">
            Tono de lectura
          </span>
          <button
            type="button"
            onClick={() => setShowCustomStyle((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#525866] transition-colors hover:text-[#141619]"
          >
            <span>
              {showCustomStyle ? 'Ocultar indicación' : 'Personalizar texto de estilo'}
            </span>
            {showCustomStyle ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Tono de lectura"
        >
          {STYLE_PRESETS.map((preset) => {
            const isActive = stylePrompt.trim() === preset.stylePrompt.trim();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChangeStylePrompt(preset.stylePrompt)}
                aria-pressed={isActive}
                className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] ${
                  isActive
                    ? 'border-[#D94E28] bg-[#FDF4F1] text-[#B33917]'
                    : 'border-[#E4E4E0] bg-[#FAFAF8] text-[#141619] hover:border-[#C9C8C2]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {showCustomStyle || styleError ? (
          <div className="mt-3">
            <label
              htmlFor="style-prompt-input"
              className="block text-xs font-medium text-[#141619]"
            >
              Indicación personalizada
            </label>
            <textarea
              id="style-prompt-input"
              rows={2}
              value={stylePrompt}
              onChange={(e) => onChangeStylePrompt(e.target.value)}
              aria-invalid={Boolean(styleError)}
              aria-describedby={styleError ? 'style-error' : undefined}
              className={`mt-1.5 w-full resize-y rounded-lg border bg-[#FAFAF8] px-3.5 py-2.5 text-xs leading-relaxed text-[#141619] transition-colors focus:bg-white focus:outline-none ${
                styleError
                  ? 'border-[#C92A2A] focus:border-[#C92A2A]'
                  : 'border-[#E4E4E0] focus:border-[#141619]'
              }`}
            />
            {styleError ? (
              <p
                id="style-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-[#C92A2A]"
              >
                {styleError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
