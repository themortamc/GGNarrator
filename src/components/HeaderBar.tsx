import { Volume2, Loader2 } from 'lucide-react';

interface HeaderBarProps {
  isGenerating: boolean;
  onGenerateFull: () => void;
}

export function HeaderBar({ isGenerating, onGenerateFull }: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E4E0] bg-[#F7F7F5]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
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
            href="#guion"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Guion
          </a>
          <a
            href="#direccion"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Dirección
          </a>
          <a
            href="#tomas"
            className="py-1 transition-colors hover:text-[#141619] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E28] rounded"
          >
            Tomas
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
            <span>{isGenerating ? 'Generando...' : 'Generar locución'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
