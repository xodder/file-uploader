import { useState } from 'react';

export function useConstant<T>(initializer: () => T): T {
  return useState(initializer)[0];
}
