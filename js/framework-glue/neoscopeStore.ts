import * as React from "react";
import { create, StoreApi, UseBoundStore } from "zustand";

// === NeoscopeStore ===
type NeoscopeStoreOptions<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
> = {
  actions?: Actions<Model, ActionsList>;
  serializers?: ModelSerializers<Model>;
  deserializers?: ModelDeserializers<Model>;
};

/**
 * @param initialState
 * @param options
 * @returns
 */
export function createNeoscopeStore<EventsList extends EventMap<EventsList> = {}>() {
  return function <Model extends Record<string, any>, ActionsList extends Record<string, (...args: any[]) => any> = {}>(
    initialState: Model,
    options?: NeoscopeStoreOptions<Model, ActionsList>,
  ): [NeoscopeStoreFactory<Model, ActionsList, EventsList>, UseNeoscopeBoundStore<Model & ActionsList & EventsList>] {
    // 1. The factory function that creates a new isolated store instance
    const createStoreInstance = (emitEvent?: EventEmitter): NeoscopeStore<Model, ActionsList, EventsList> => {
      const actions: Actions<Model, ActionsList> = options?.actions ?? (() => ({}) as ActionsList);

      const store = create<Model & ActionsList>((set) => ({
        ...initialState,
        ...actions(
          set as (
            partial: Model | Partial<Model> | ((state: Model) => Model | Partial<Model>),
            replace?: false,
          ) => void,
        ),
      })) as NeoscopeStore<Model, ActionsList, EventsList>;

      store.initialState = () => initialState;
      store.serializers = options?.serializers ?? {};
      store.deserializers = options?.deserializers ?? {};
      store.emitEvent = emitEvent;

      return store;
    };

    // 2. Hook that use the store provided by the React context
    const useScopedStore: UseNeoscopeBoundStore<Model & ActionsList & EventsList> = <U>(
      selector?: (state: Model & ActionsList & EventsList) => U,
    ) => {
      const store = React.useContext(NeoscopeStoreContext);
      if (!store) throw new Error("This hook must be used within a NeoscopeStoreContext provider.");

      // Create a proxy to intercept event calls and forward them to the store's emitEvent function
      const createStateProxy = (targetState: any) =>
        new Proxy(targetState, {
          get(target, prop, receiver) {
            if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
            if (typeof prop !== "string") return undefined;

            return (...args: any[]) => {
              if (store.emitEvent) store.emitEvent(prop, args);
              else console.warn(`[Neoscope] The event "${prop}" was called but no emitter is attached.`);
            };
          },
        });

      return selector ? store((state) => selector(createStateProxy(state))) : createStateProxy(store());
    };

    return [createStoreInstance, useScopedStore];
  };
}

// === STORE TYPE ===
export type NeoscopeStore<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
  EventsList extends EventMap = {},
> = UseBoundStore<StoreApi<Model & ActionsList & EventsList>> & StoreExtensions<Model>;

// --- Actions & Events ---
export type Actions<Model extends Record<string, any>, ActionsList extends Record<string, (...args: any[]) => any>> = (
  set: (partial: Model | Partial<Model> | ((state: Model) => Model | Partial<Model>), replace?: false) => void,
) => ActionsList;

// --- Serializers / Deserializers ---
export type ModelSerializers<Model extends Record<string, any>> = {
  [K in keyof Model]?: (value: Model[K]) => DataView;
};

export type ModelDeserializers<Model extends Record<string, any>> = {
  [K in keyof Model]?: (bytes: DataView) => Model[K];
};

// --- Events ---
export type EventMap<T = any> = {
  [K in keyof T]: (...args: any[]) => void;
};
export type EventEmitter = (eventName: string, args: any[]) => void;

// --- All type extensions ---
interface StoreExtensions<Model extends Record<string, any>> {
  initialState: () => Model;
  serializers: ModelSerializers<Model>;
  deserializers: ModelDeserializers<Model>;
  emitEvent?: EventEmitter;
}

// === NeoscopeStoreFactory ===
export type NeoscopeStoreFactory<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
  EventsList extends EventMap<EventsList> = {},
> = (emitEvent?: EventEmitter) => NeoscopeStore<Model, ActionsList, EventsList>;

export const NeoscopeStoreContext = React.createContext<NeoscopeStore<any, any> | null>(null);

export interface UseNeoscopeBoundStore<State> {
  (): State;
  <U>(selector: (state: State) => U): U;
}
