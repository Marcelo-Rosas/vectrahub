import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { isChunkLoadError, reloadForChunkError } from '@/lib/lazy-with-retry';

interface ErrorFallbackProps extends FallbackProps {
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  title = 'Algo deu errado',
  description = 'Ocorreu um erro inesperado nesta seção.',
}: ErrorFallbackProps) {
  const chunkStale = isChunkLoadError(error);

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-destructive">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {chunkStale ? 'Nova versão publicada. Recarregue a página para continuar.' : description}
        </p>
        {error?.message && !chunkStale && (
          <p className="mt-2 rounded bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={chunkStale ? reloadForChunkError : resetErrorBoundary}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        {chunkStale ? 'Recarregar página' : 'Tentar novamente'}
      </Button>
    </div>
  );
}
