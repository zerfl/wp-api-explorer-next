"use client";

import { useCallback, useMemo, useRef } from "react";
import type { WalkEvent, WindowedWalker } from "@/lib/windowed-walk";

type Walker = WindowedWalker<{ id: number }>;

export interface WalkerLease {
  walker: Walker;
  /** True when a new walker was created for this signature (cursor reset). */
  fresh: boolean;
}

export interface WalkerStore {
  isWindowed: () => boolean;
  setWindowed: (enabled: boolean) => void;
  reset: () => void;
  lease: (signature: string, create: () => Walker) => WalkerLease;
  setEventSink: (sink: ((event: WalkEvent) => void) | null) => void;
  emit: (event: WalkEvent) => void;
  recordResponse: (status: number, statusText: string) => void;
  lastResponse: () => { status: number; statusText: string } | null;
}

export function useWalkerStore(): WalkerStore {
  const windowedRef = useRef(false);
  const walkerRef = useRef<{ signature: string; walker: Walker } | null>(null);
  const sinkRef = useRef<((event: WalkEvent) => void) | null>(null);
  const lastResponseRef = useRef<{ status: number; statusText: string } | null>(null);

  const isWindowed = useCallback(() => windowedRef.current, []);
  const setWindowed = useCallback((enabled: boolean) => {
    windowedRef.current = enabled;
  }, []);
  const reset = useCallback(() => {
    walkerRef.current = null;
    lastResponseRef.current = null;
  }, []);
  const lease = useCallback((signature: string, create: () => Walker): WalkerLease => {
    const existing = walkerRef.current;
    if (existing && existing.signature === signature) {
      return { walker: existing.walker, fresh: false };
    }
    lastResponseRef.current = null;
    const walker = create();
    walkerRef.current = { signature, walker };
    return { walker, fresh: true };
  }, []);
  const setEventSink = useCallback((sink: ((event: WalkEvent) => void) | null) => {
    sinkRef.current = sink;
  }, []);
  const emit = useCallback((event: WalkEvent) => {
    sinkRef.current?.(event);
  }, []);
  const recordResponse = useCallback((status: number, statusText: string) => {
    lastResponseRef.current = { status, statusText };
  }, []);
  const lastResponse = useCallback(() => lastResponseRef.current, []);

  return useMemo(
    () => ({
      isWindowed,
      setWindowed,
      reset,
      lease,
      setEventSink,
      emit,
      recordResponse,
      lastResponse,
    }),
    [emit, isWindowed, lastResponse, lease, recordResponse, reset, setEventSink, setWindowed]
  );
}
