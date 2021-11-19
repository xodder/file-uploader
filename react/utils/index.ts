import React from 'react';

export function useConstant<T>(func: () => T): T {
  return React.useState(func)[0];
}

export function useMountedCallback(
  callback: () => any,
  deps: React.DependencyList
) {
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return React.useCallback(
    (...args) => {
      if (mountedRef.current) {
        return callback.apply(void 0, args as []);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, ...deps]
  );
}

export function useRerender() {
  const [, dispatch] = React.useReducer((s) => s + 1, 0);
  return useMountedCallback(dispatch, []);
}
