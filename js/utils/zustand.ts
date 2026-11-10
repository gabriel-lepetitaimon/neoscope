import { createStore, StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { StateCreator } from "zustand";

/**
 * createInstanciatedStore
 *
 * This function creates a store that can be shared across multiple instances of a component.
 * It uses globalThis to store the vanilla StoreApi, and returns a hook that binds the shared store to the local React copy.
 *
 * @param storeName - A unique name for the store, used to create a Symbol key in globalThis.
 * @param initializer - A function that initializes the state of the store.
 * @returns A hook that can be used to access the shared store in React components.
 *
 * Usage:
 * const useMyStore = createInstanciatedStore<MyStateType>("MyStore", (set) => ({
 *   // initial state and actions
 * }));
 *
 * In a React component:
 * const myState = useMyStore(instanceId, (state) => state.someValue);
 *
 * You can also access the vanilla store outside of React renders:
 * const store = useMyStore.getStore(instanceId);
 * const state = useMyStore.getState(instanceId);
 *
 * Warning:
 * Class inside store may be reduced to simple object when serialized from one react instance to another. Use simple objects or primitives in the store state to avoid issues.
 */
export function createInstanciatedStore<T>(storeName: string, initializer: StateCreator<T, [], []>) {
  const globalObj = globalThis as Record<PropertyKey, unknown>;
  const STORE_KEY = Symbol.for("neoscope.shared_stores." + storeName);

  if (!globalObj[STORE_KEY]) {
    globalObj[STORE_KEY] = {};
  }

  // Save the framework-agnostic vanilla StoreApi on globalThis
  const stores = globalObj[STORE_KEY] as Record<number, StoreApi<T>>;

  const getVanillaStore = (instance: number): StoreApi<T> => {
    let store = stores[instance];
    if (!store) {
      store = createStore<T>(initializer);
      stores[instance] = store;
    }
    return store;
  };

  // Return a hook that binds the shared vanilla store to THIS widget's local React copy
  function useInstanciatedStore<U = T>(
    instance: number,
    selector: (state: T) => U = (state) => state as unknown as U,
  ): U {
    const store = getVanillaStore(instance);
    return useStore(store, selector);
  }

  // Attach getVanillaStore so you can access .getState() outside React renders
  useInstanciatedStore.getStore = getVanillaStore;
  useInstanciatedStore.getState = (instance: number) => getVanillaStore(instance).getState();

  return useInstanciatedStore;
}
