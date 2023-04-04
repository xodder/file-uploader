import React from 'react';

function useConstant<T>(fn: () => T): T {
  return React.useState(fn)[0];
}

export default useConstant;
