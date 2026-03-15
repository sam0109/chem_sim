// ==============================================================
// SimulationContext — React context for per-panel simulation stores
// Allows multiple simulation panels to each have their own store
// ==============================================================

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { SimulationStoreState } from './simulationStore';

/**
 * Context holds a vanilla Zustand store (StoreApi), not a hook.
 * Each SimulationPanel provides its own store; components inside
 * the panel read from whichever store is in context.
 *
 * null means "no provider above — fall back to the global default".
 */
export const SimulationContext =
  createContext<StoreApi<SimulationStoreState> | null>(null);

/**
 * Hook to select state from the nearest SimulationContext store.
 * Usage mirrors useSimulationStore: `useSimContextStore(s => s.atoms)`
 *
 * If no provider is found, throws — callers must be inside a
 * SimulationProvider (or the App-level provider wrapping the default store).
 */
export function useSimContextStore<T>(
  selector: (state: SimulationStoreState) => T,
): T {
  const store = useContext(SimulationContext);
  if (!store) {
    throw new Error(
      'useSimContextStore must be used inside a <SimulationContext.Provider>',
    );
  }
  return useStore(store, selector);
}

/**
 * Hook to get the raw store API (for getState() in useFrame callbacks
 * and imperative code like Interaction handlers).
 */
export function useSimContextStoreApi(): StoreApi<SimulationStoreState> {
  const store = useContext(SimulationContext);
  if (!store) {
    throw new Error(
      'useSimContextStoreApi must be used inside a <SimulationContext.Provider>',
    );
  }
  return store;
}
