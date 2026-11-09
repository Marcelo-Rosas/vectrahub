import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { isChunkLoadError, reloadForChunkError } from '@/lib/lazy-with-retry';
import { logger } from '@/lib/logger';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  resetKeys?: unknown[];
}

/** Error boundary global — envolve toda a aplicação */
export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="w-full max-w-md">
            <ErrorFallback
              {...props}
              title="Erro na aplicação"
              description="A aplicação encontrou um erro crítico. Recarregue a página ou tente novamente."
            />
          </div>
        </div>
      )}
      onError={(error, info) => {
        if (isChunkLoadError(error)) {
          reloadForChunkError();
          return;
        }
        logger.captureException(error, { componentStack: info.componentStack ?? '' });
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/** Error boundary de seção — isola módulos individuais */
export function SectionErrorBoundary({
  children,
  title,
  description,
  resetKeys,
}: SectionErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <ErrorFallback {...props} title={title} description={description} />
      )}
      onError={(error, info) => {
        if (isChunkLoadError(error)) {
          reloadForChunkError();
          return;
        }
        logger.captureException(error, { componentStack: info.componentStack ?? '' });
      }}
      resetKeys={resetKeys}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/** Route-aware error boundary — auto-resets when the URL changes */
export function RouteErrorBoundary({
  children,
  title,
  description,
}: Omit<SectionErrorBoundaryProps, 'resetKeys'>) {
  const location = useLocation();
  return (
    <SectionErrorBoundary title={title} description={description} resetKeys={[location.pathname]}>
      {children}
    </SectionErrorBoundary>
  );
}
