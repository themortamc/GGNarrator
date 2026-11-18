import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useState } from 'react';
import type { VoiceName } from '../utils/scriptAnalysis';

interface ClaudeConnectPanelProps {
  selectedVoice: VoiceName;
  scriptText: string;
}

export function ClaudeConnectPanel({
  selectedVoice,
  scriptText,
}: ClaudeConnectPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const mcpUrl = `${origin}/mcp`;
  const claudeCodeCmd = `claude mcp add --transport http mortups-tts ${mcpUrl}`;
  const sampleOneLine = scriptText.replace(/\s+/g, ' ').trim().slice(0, 120);
  const curlCmd = `curl -sS -X POST ${origin}/api/tts/wav -H "Content-Type: application/json" -d '${JSON.stringify(
    {
      text: sampleOneLine || 'Hola, este es un texto de prueba para locución.',
      voiceName: selectedVoice,
    }
  )}' --output locucion.wav`;

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <section
      id="conectar"
      aria-labelledby="conectar-heading"
      className="rounded-xl border border-[#E4E4E0] bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="conectar-heading"
            className="font-display text-base font-semibold tracking-tight text-[#141619]"
          >
            Conectar con Claude Code o Claude Web
          </h2>
          <p className="mt-0.5 text-xs text-[#525866]">
            Endpoint MCP (<span className="font-mono">/mcp</span>) y descarga
            directa en WAV (<span className="font-mono">/api/tts/wav</span>).
          </p>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] px-3 py-1.5 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] whitespace-nowrap shrink-0"
        >
          <span>{isOpen ? 'Ocultar' : 'Ver instrucciones'}</span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 space-y-4 border-t border-[#ECECE8] pt-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#141619]">
                1. Comando para Claude Code
              </span>
              <button
                type="button"
                onClick={() => copyText('claude-code', claudeCodeCmd)}
                aria-label="Copiar comando de Claude Code"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0"
              >
                {copiedId === 'claude-code' ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedId === 'claude-code' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2 font-mono text-xs text-[#141619]">
              {claudeCodeCmd}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#141619]">
                2. URL MCP para Claude Web (Integraciones)
              </span>
              <button
                type="button"
                onClick={() => copyText('mcp-url', mcpUrl)}
                aria-label="Copiar URL del endpoint MCP"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0"
              >
                {copiedId === 'mcp-url' ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedId === 'mcp-url' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2 font-mono text-xs text-[#141619]">
              {mcpUrl}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#141619]">
                3. Descarga directa WAV vía curl
              </span>
              <button
                type="button"
                onClick={() => copyText('curl', curlCmd)}
                aria-label="Copiar comando curl para descargar WAV"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0"
              >
                {copiedId === 'curl' ? (
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedId === 'curl' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2 font-mono text-xs text-[#141619]">
              {curlCmd}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
