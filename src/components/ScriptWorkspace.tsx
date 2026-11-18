import { Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import {
  analyzeProsody,
  tokenizeProsodyText,
} from '../utils/prosodyAnalyzer';
import { formatDuration, type ScriptAnalysis } from '../utils/scriptAnalysis';

interface ScriptWorkspaceProps {
  scriptText: string;
  onChangeScript: (value: string) => void;
  onClearScript: () => void;
  analysis: ScriptAnalysis;
  validationError?: string;
}

function renderWithPauseCues(text: string) {
  const tokens = tokenizeProsodyText(text);
  return tokens.map((token, idx) => {
    if (token.type === 'pause') {
      return (
        <span
          key={idx}
          className="mx-0.5 font-mono text-xs font-semibold text-[#D94E28]"
          title="Pausa natural"
        >
          ···
        </span>
      );
    }
    if (token.type === 'breath') {
      return (
        <span
          key={idx}
          className="mx-1 font-mono text-[11px] font-medium text-[#15803D]"
          title="Respiración natural"
        >
          [respiro]
        </span>
      );
    }
    return <Fragment key={idx}>{token.value}</Fragment>;
  });
}

export function ScriptWorkspace({
  scriptText,
  onChangeScript,
  onClearScript,
  analysis,
  validationError,
}: ScriptWorkspaceProps) {
  const [showProsodyPreview, setShowProsodyPreview] = useState(false);

  const prosody = useMemo(() => analyzeProsody(scriptText), [scriptText]);
  const hasText = scriptText.trim().length > 0;

  return (
    <section
      id="texto"
      aria-labelledby="texto-heading"
      className="rounded-xl border border-[#E4E4E0] bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="texto-heading"
            className="font-display text-lg font-semibold tracking-tight text-[#141619]"
          >
            Tu texto
          </h2>
          <p className="mt-0.5 text-xs text-[#525866] tabular-nums">
            <span>{analysis.wordCount} palabras</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>~{formatDuration(analysis.estimatedDurationSeconds)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasText ? (
            <button
              type="button"
              onClick={() => setShowProsodyPreview((prev) => !prev)}
              className="inline-flex min-h-9 items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#525866] transition-colors hover:text-[#141619] whitespace-nowrap shrink-0"
            >
              {showProsodyPreview ? 'Ocultar pausas' : 'Ver pausas'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClearScript}
            disabled={!hasText}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#525866] transition-colors hover:border-[#141619] hover:text-[#141619] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="script-editor" className="sr-only">
          Texto para locución
        </label>
        <textarea
          id="script-editor"
          rows={9}
          value={scriptText}
          onChange={(e) => onChangeScript(e.target.value)}
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? 'script-error' : undefined}
          placeholder="Escribí o pegá tu texto normal acá. El ritmo, las pausas y respiraciones se agregan automáticamente al generar el audio."
          className={`w-full resize-y rounded-lg border bg-[#FAFAF8] px-4 py-3.5 text-[15px] leading-[1.7] text-[#141619] transition-colors placeholder:text-[#8B909A] focus:bg-white focus:outline-none ${
            validationError
              ? 'border-[#C92A2A] focus:border-[#C92A2A]'
              : 'border-[#E4E4E0] focus:border-[#141619]'
          }`}
        />
        {validationError ? (
          <p
            id="script-error"
            role="alert"
            className="mt-2 text-xs font-medium text-[#C92A2A]"
          >
            {validationError}
          </p>
        ) : null}
      </div>

      {hasText && showProsodyPreview ? (
        <div className="mt-3 rounded-lg border border-[#ECECE8] bg-[#FAFAF8] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#525866]">
            <span className="tabular-nums">
              {prosody.autoPausesCount > 0 || prosody.autoBreathsCount > 0
                ? `+${prosody.autoPausesCount} pausas y +${prosody.autoBreathsCount} respiraciones detectadas`
                : `${prosody.totalPausesCount} pausas y ${prosody.totalBreathsCount} respiraciones listas`}
            </span>
            {prosody.changed ? (
              <button
                type="button"
                onClick={() => onChangeScript(prosody.preparedText)}
                className="font-medium text-[#141619] underline-offset-4 hover:underline"
              >
                Aplicar al texto
              </button>
            ) : null}
          </div>
          <p className="mt-2 border-t border-[#E6E5E0] pt-2 text-sm leading-relaxed text-[#141619] whitespace-pre-wrap">
            {renderWithPauseCues(prosody.preparedText)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
