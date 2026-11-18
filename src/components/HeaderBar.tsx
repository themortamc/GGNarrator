import { Loader2, Volume2 } from 'lucide-react';

interface HeaderBarProps {
  isGenerating: boolean;
  onGenerateFull: () => void;
}

export function HeaderBar({ isGenerating, onGenerateFull }: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E4E0] bg-[#F7F7F5]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-8 px-4 sm:px-6">
        <a
          href="#top"
          className="font-display text-lg font-semibold tracking-tight text-[#141619] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
        >
          Mortups Locución
        </a>

        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#525866]"
        >
          <a
            href="#texto"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Texto
          </a>
          <a
            href="#voz"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Voz
          </a>
          <a
            href="#conectar"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Conectar
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onGenerateFull}
            disabled={isGenerating}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#D94E28] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#BE411E] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28]"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isGenerating ? 'Generando...' : 'Generar audio'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
