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
>(initialState: Model, options?: NeoscopeStoreOptions<Model, ActionsList>): NeoscopeStore<Model, ActionsList> {
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
}
