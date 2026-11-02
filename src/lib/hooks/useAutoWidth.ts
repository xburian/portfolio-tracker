import { useState, useRef, useEffect } from 'react';

/**
 * Ultra-reliable responsive width hook for Recharts.
 * Bypasses Recharts' internal ResponsiveContainer which frequently collapses to 0px
 * in hidden tabs, flexbox columns, or during React 19 concurrent renders.
 */
export function useAutoWidth(fallbackWidth: number = 800) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 0) {
      return Math.max(300, Math.min(window.innerWidth - 64, 1400));
    }
    return fallbackWidth;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (containerRef.current) {
        const measured = containerRef.current.clientWidth || containerRef.current.getBoundingClientRect().width;
        if (measured > 0) {
          setWidth(Math.floor(measured));
        }
      }
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        measure();
      });
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', measure);

    // Re-measure after 50ms and 150ms to catch active tab transition layout settling
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return { containerRef, width };
}
