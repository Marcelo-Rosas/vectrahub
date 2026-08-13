/**
 * Declarações para o runtime Deno nas Edge Functions.
 * Usado por funções que importam std/http/server ou usam o global Deno.
 */
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
    toObject(): Record<string, string>;
  };
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string }
  ): void;
}

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number }
  ): void;
}

declare module 'https://esm.sh/js-sha256@0.11.0' {
  export function sha256(message: string | ArrayBuffer): string;
}
