import { Check, Copy } from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const mcpUrl = `${origin}/mcp`;
  const claudeCodeCmd = `claude mcp add --transport http mortups-tts ${mcpUrl}`;
  const sampleOneLine = scriptText.replace(/\s+/g, ' ').trim().slice(0, 120);
  const curlCmd = `curl -sS -X POST ${origin}/api/tts/wav -H "Content-Type: application/json" -d '${JSON.stringify(
    {
      text: sampleOneLine || 'Tener una página web linda... ya no alcanza.',
      voiceName: selectedVoice,
    }
  )}' --output mortups.wav`;

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
      className="rounded-xl border border-[#E4E4E0] bg-white p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="conectar-heading"
            className="font-display text-xl font-semibold tracking-tight text-[#141619]"
          >
            Conexión con Claude Code y Claude Web
          </h2>
          <p className="mt-1 text-xs text-[#525866]">
            Servidor MCP Streamable HTTP (<span className="font-mono">/mcp</span>)
            y descarga directa en WAV (<span className="font-mono">/api/tts/wav</span>).
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#141619]">
              1. Comando para Claude Code (MCP remoto o local)
            </span>
            <button
              type="button"
              onClick={() => copyText('claude-code', claudeCodeCmd)}
              aria-label="Copiar comando de Claude Code"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              {copiedId === 'claude-code' ? (
                <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedId === 'claude-code' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2.5 font-mono text-xs text-[#141619]">
            {claudeCodeCmd}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#141619]">
              2. URL de conector MCP para Claude Web (Integraciones)
            </span>
            <button
              type="button"
              onClick={() => copyText('mcp-url', mcpUrl)}
              aria-label="Copiar URL del endpoint MCP"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              {copiedId === 'mcp-url' ? (
                <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedId === 'mcp-url' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2.5 font-mono text-xs text-[#141619]">
            {mcpUrl}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#141619]">
              3. Descarga directa de archivo WAV vía curl
            </span>
            <button
              type="button"
              onClick={() => copyText('curl', curlCmd)}
              aria-label="Copiar comando curl para descargar WAV"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E4E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#141619] transition-colors hover:border-[#141619] hover:bg-[#FAFAF8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
            >
              {copiedId === 'curl' ? (
                <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedId === 'curl' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[#ECECE8] bg-[#FAFAF8] px-3.5 py-2.5 font-mono text-xs text-[#141619]">
            {curlCmd}
          </pre>
        </div>

        <p className="border-t border-[#ECECE8] pt-3 text-xs leading-relaxed text-[#525866]">
          Herramientas MCP disponibles:{' '}
          <span className="font-mono text-[#141619]">obtener_guion_mortups</span>{' '}
          y <span className="font-mono text-[#141619]">generar_locucion</span>.
          Si publicás esta app para usarla desde Claude Web sin login de AI
          Studio, configurá <span className="font-mono text-[#141619]">MCP_AUTH_TOKEN</span>{' '}
          en Settings &gt; Secrets para requerir{' '}
          <span className="font-mono text-[#141619]">Authorization: Bearer</span>.
        </p>
      </div>
    </section>
  );
}
