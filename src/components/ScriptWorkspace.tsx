import { RotateCcw, Play } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  formatDuration,
  type ScriptAnalysis,
  type ScriptBlock,
} from '../utils/scriptAnalysis';

interface ScriptWorkspaceProps {
  scriptText: string;
  onChangeScript: (value: string) => void;
  onResetDefault: () => void;
  isDefaultScript: boolean;
  analysis: ScriptAnalysis;
  validationError?: string;
  isGenerating: boolean;
  onGenerateBlock: (block: ScriptBlock) => void;
}

function renderWithPauseCues(text: string) {
  const parts = text.split('...');
  return parts.map((segment, idx) => (
    <Fragment key={idx}>
      <span>{segment}</span>
      {idx < parts.length - 1 ? (
        <span
          className="mx-0.5 font-mono text-xs font-semibold text-[#D94E28]"
          title="Pausa respiratoria marcada con puntos suspensivos"
        >
          ···
        </span>
      ) : null}
    </Fragment>
  ));
}

export function ScriptWorkspace({
  scriptText,
  onChangeScript,
  onResetDefault,
  isDefaultScript,
  analysis,
  validationError,
  isGenerating,
  onGenerateBlock,
}: ScriptWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'editor' | 'blocks'>('editor');

  return (
    <section
      id="guion"
      aria-labelledby="guion-heading"
      className="rounded-xl border border-[#E4E4E0] bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="guion-heading"
            className="font-display text-xl font-semibold tracking-tight text-[#141619]"
          >
            Guion comercial
          </h2>
          <p className="mt-1 text-xs text-[#525866] tabular-nums">
            <span>{analysis.paragraphCount} bloques</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>{analysis.wordCount} palabras</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>{analysis.ellipsisCount} pausas (...)</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>~{formatDuration(analysis.estimatedDurationSeconds)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Modo de vista del guion"
            className="inline-flex items-center rounded-lg bg-[#F0F0EC] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'editor'}
              onClick={() => setViewMode('editor')}
              className={`min-h-8 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#D94E28] ${
                viewMode === 'editor'
                  ? 'bg-white text-[#141619] shadow-xs'
                  : 'text-[#525866] hover:text-[#141619]'
              }`}
            >
              Editor directo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'blocks'}
              onClick={() => setViewMode('blocks')}
              className={`min-h-8 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#D94E28] ${
                viewMode === 'blocks'
                  ? 'bg-white text-[#141619] shadow-xs'
                  : 'text-[#525866] hover:text-[#141619]'
              }`}
            >
              Desglose por bloques
            </button>
          </div>

          <button
            type="button"
            onClick={onResetDefault}
            disabled={isDefaultScript}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restaurar original</span>
          </button>
        </div>
      </div>

      {viewMode === 'editor' ? (
        <div className="mt-5">
          <label
            htmlFor="script-editor"
            className="block text-sm font-medium text-[#141619]"
          >
            Texto para locución
          </label>
          <p className="mt-1 text-xs text-[#525866]">
            Respetá los puntos seguidos y puntos suspensivos (...) para sostener
            respiraciones naturales.
          </p>
          <textarea
            id="script-editor"
            rows={12}
            value={scriptText}
            onChange={(e) => onChangeScript(e.target.value)}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? 'script-error' : undefined}
            placeholder="Escribí o pegá el guion comercial..."
            className={`mt-2.5 w-full resize-y rounded-lg border bg-[#FAFAF8] px-4 py-3.5 text-[15px] leading-[1.7] text-[#141619] transition-colors placeholder:text-[#8B909A] focus:bg-white focus:outline-none ${
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
      ) : (
        <div className="mt-5 divide-y divide-[#ECECE8] border-t border-[#ECECE8]">
          {analysis.blocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#525866]">
              El guion está vacío. Cambiá a Editor directo o restaurá el guion
              original de Mortups.
            </p>
          ) : (
            analysis.blocks.map((block) => (
              <div
                key={block.index}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866] tabular-nums">
                    <span className="font-medium text-[#141619]">
                      {block.label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{block.wordCount} palabras</span>
                    <span aria-hidden="true">·</span>
                    <span>~{formatDuration(block.estimatedSeconds)}</span>
                    {block.ellipsisCount > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {block.ellipsisCount}{' '}
                          {block.ellipsisCount === 1 ? 'pausa' : 'pausas'} (...)
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[15px] leading-[1.7] text-[#141619]">
                    {renderWithPauseCues(block.text)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onGenerateBlock(block)}
                  disabled={isGenerating}
                  aria-label={`Probar ${block.label}`}
                  className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Probar bloque</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
