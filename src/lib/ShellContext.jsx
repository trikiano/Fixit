import React, { createContext, useContext, useCallback } from 'react';

const ShellContext = createContext({ openTab: () => {} });

export function useShell() {
  return useContext(ShellContext);
}

export const ShellContext_ = ShellContext;
