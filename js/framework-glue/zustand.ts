import { create, StoreApi, UseBoundStore } from "zustand";

interface StoreInitialStateAction<Model extends Record<string, any>> {
  initialState: () => Model;
}

export type NeoscopeStore<Model extends Record<string, any>, Actions extends Record<string, any>> = UseBoundStore<
  StoreApi<Model & Actions>
> &
  StoreInitialStateAction<Model>;

export function createNeoscopeStore<Model extends Record<string, any>, Actions extends Record<string, any>>(
  initialState: Model,
  actions: (
    set: (
      partial:
        | (Model & Actions)
        | Partial<Model & Actions>
        | ((state: Model & Actions) => (Model & Actions) | Partial<Model & Actions>),
      replace?: false,
    ) => void,
  ) => Actions,
): NeoscopeStore<Model, Actions> {
  const store = create<Model & Actions>((set) => ({
    ...initialState,
    ...actions(set),
  })) as NeoscopeStore<Model, Actions>;
  store.initialState = () => initialState;
  return store;
}
