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
  return (
    <section
      id="direccion"
      aria-labelledby="direccion-heading"
      className="rounded-xl border border-[#E4E4E0] bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="direccion-heading"
            className="font-display text-xl font-semibold tracking-tight text-[#141619]"
          >
            Dirección actoral y voz
          </h2>
          <p className="mt-1 text-xs text-[#525866]">
            Control de intención comercial rioplatense y selección de timbre en
            Gemini 3.8 Flash TTS.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <span className="block text-xs font-medium text-[#525866]">
          Enfoque interpretativo
        </span>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Presets de dirección actoral"
        >
          {STYLE_PRESETS.map((preset) => {
            const isActive = stylePrompt.trim() === preset.stylePrompt.trim();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChangeStylePrompt(preset.stylePrompt)}
                aria-pressed={isActive}
                className={`min-h-9 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] ${
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
      </div>

      <div className="mt-5">
        <label
          htmlFor="style-prompt-input"
          className="block text-sm font-medium text-[#141619]"
        >
          Indicación de estilo (Style Prompt)
        </label>
        <textarea
          id="style-prompt-input"
          rows={3}
          value={stylePrompt}
          onChange={(e) => onChangeStylePrompt(e.target.value)}
          aria-invalid={Boolean(styleError)}
          aria-describedby={styleError ? 'style-error' : undefined}
          className={`mt-2 w-full resize-y rounded-lg border bg-[#FAFAF8] px-4 py-3 text-sm leading-relaxed text-[#141619] transition-colors focus:bg-white focus:outline-none ${
            styleError
              ? 'border-[#C92A2A] focus:border-[#C92A2A]'
              : 'border-[#E4E4E0] focus:border-[#141619]'
          }`}
        />
        {styleError ? (
          <p
            id="style-error"
            role="alert"
            className="mt-2 text-xs font-medium text-[#C92A2A]"
          >
            {styleError}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <span className="block text-sm font-medium text-[#141619]">
          Voz base
        </span>
        <div
          role="radiogroup"
          aria-label="Selección de voz base"
          className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          {VOICE_OPTIONS.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            return (
              <button
                key={voice.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectVoice(voice.id)}
                className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] ${
                  isSelected
                    ? 'border-[#D94E28] bg-[#FDF4F1]'
                    : 'border-[#E4E4E0] bg-white hover:border-[#B9B8B0]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-[#141619]">
                    {voice.label}
                  </span>
                  {voice.recommended ? (
                    <span className="text-[11px] font-medium text-[#B33917]">
                      Sugerida
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 text-xs leading-snug text-[#525866]">
                  {voice.profile}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
