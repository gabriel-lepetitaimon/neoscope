import * as React from "react";
import { create, StoreApi, UseBoundStore } from "zustand";

export type ModelSerializers<Model extends Record<string, any>> = {
  [K in keyof Model]?: (value: Model[K]) => DataView;
};

export type ModelDeserializers<Model extends Record<string, any>> = {
  [K in keyof Model]?: (bytes: DataView) => Model[K];
};

interface StoreExtensions<Model extends Record<string, any>> {
  initialState: () => Model;
  serializers: ModelSerializers<Model>;
  deserializers: ModelDeserializers<Model>;
}

export type Actions<Model extends Record<string, any>, ActionsList extends Record<string, (...args: any[]) => any>> = (
  set: (partial: Model | Partial<Model> | ((state: Model) => Model | Partial<Model>), replace?: false) => void,
) => ActionsList;

export type NeoscopeStore<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
> = UseBoundStore<StoreApi<Model & ActionsList>> & StoreExtensions<Model>;

export type NeoscopeStoreFactory<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
> = () => NeoscopeStore<Model, ActionsList>;

// Contexte interne qui porte l'instance du store de chaque widget
export const NeoscopeStoreContext = React.createContext<NeoscopeStore<any, any> | null>(null);

// Type du hook retourné (supporte l'appel sans argument OU avec un sélecteur Zustand)
export interface UseNeoscopeBoundStore<State> {
  (): State;
  <U>(selector: (state: State) => U): U;
}

type NeoscopeStoreOptions<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
> = {
  actions?: Actions<Model, ActionsList>;
  serializers?: ModelSerializers<Model>;
  deserializers?: ModelDeserializers<Model>;
};

export function createNeoscopeStore<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
>(
  initialState: Model,
  options?: NeoscopeStoreOptions<Model, ActionsList>,
): [NeoscopeStoreFactory<Model, ActionsList>, UseNeoscopeBoundStore<Model & ActionsList>] {
  // 1. La fabrique qui instancie un nouveau store isolé à chaque appel
  const createStoreInstance = (): NeoscopeStore<Model, ActionsList> => {
    const actions: Actions<Model, ActionsList> = options?.actions ?? (() => ({}) as ActionsList);
    const store = create<Model & ActionsList>((set) => ({
      ...initialState,
      ...actions(
        set as (partial: Model | Partial<Model> | ((state: Model) => Model | Partial<Model>), replace?: false) => void,
      ),
    })) as NeoscopeStore<Model, ActionsList>;

    store.initialState = () => initialState;
    store.serializers = options?.serializers ?? {};
    store.deserializers = options?.deserializers ?? {};

    return store;
  };

  // 2. Le hook typé qui lit le store isolé depuis le Contexte React
  const useScopedStore: UseNeoscopeBoundStore<Model & ActionsList> = <U>(
    selector?: (state: Model & ActionsList) => U,
  ) => {
    const store = React.useContext(NeoscopeStoreContext);
    if (!store) {
      throw new Error("Ce hook doit être utilisé à l'intérieur d'un widget Neoscope.");
    }
    return selector ? store(selector) : store();
  };

  return [createStoreInstance, useScopedStore];
}
