"use client";

import { useEffect, useState } from "react";

/**
 * Returns a callback ref and whether its element intersects the viewport.
 * Unmounted counts as out of view; mounted but not yet measured counts as in view.
 */
export function useInView<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState<boolean | null>(null);

  useEffect(() => {
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(node);
    return () => {
      observer.disconnect();
      setInView(null);
    };
  }, [node]);

  return [setNode, node ? inView ?? true : false];
}
