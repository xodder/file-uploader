import { useCallback, useEffect, useReducer, useRef } from 'react';

export function useRerender() {
  const [, dispatch] = useReducer((c: number) => (c + 1) % 100, 0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(() => {
    if (mountedRef.current) {
      dispatch();
    }
  }, []);
}
