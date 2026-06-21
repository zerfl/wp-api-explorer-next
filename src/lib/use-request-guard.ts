"use client";

import { useCallback, useMemo, useRef } from "react";

export interface RequestTicket {
  /** Pass to a fetch so a superseding request cancels this one. */
  signal: AbortSignal;
  /** True only while this is the most recently started request. */
  isCurrent: () => boolean;
}

export interface RequestGuard {
  /**
   * Start a new request: aborts any still-in-flight request and hands back a
   * ticket. Comparing `isCurrent()` before committing state guarantees a slow
   * earlier response can never clobber a newer one.
   */
  begin: () => RequestTicket;
}

/**
 * Encapsulates the "latest request wins" pattern. Refs live here (the sanctioned
 * place for ref mutation) rather than in the component body, so callers stay free
 * of render-time ref access.
 */
export function useRequestGuard(): RequestGuard {
  const idRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const begin = useCallback<RequestGuard["begin"]>(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const id = idRef.current + 1;
    idRef.current = id;

    return {
      signal: controller.signal,
      isCurrent: () => idRef.current === id,
    };
  }, []);

  // Stable reference so consumers can safely list the guard in dependency arrays.
  return useMemo(() => ({ begin }), [begin]);
}
