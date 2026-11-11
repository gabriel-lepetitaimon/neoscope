import * as React from "react";
import { create, StoreApi, UseBoundStore } from "zustand";

// ============================================================================
//   --- NEOSCOPE STORE FACTORY ---
// ============================================================================
type NeoscopeStoreOptions<
  Model extends Record<string, any>,
  ActionsList extends Record<string, (...args: any[]) => any>,
> = {
  actions?: Actions<Model, ActionsList>;
};

export function createNeoscopeStore<EventsList extends EventMap<EventsList> = {}>() {
  return function <S extends ModelSchema, ActionsList extends Record<string, (...args: any[]) => any> = {}>(
    schema: S,
    options?: NeoscopeStoreOptions<InferModel<S>, ActionsList>,
  ): [
    NeoscopeStoreFactory<InferModel<S>, ActionsList, EventsList>,
    UseNeoscopeBoundStore<InferModel<S> & ActionsList & EventsList>,
  ] {
    type Model = InferModel<S>;

    // 1. The factory function that creates a new isolated store instance
    const createStoreInstance = (emitEvent?: EventEmitter): NeoscopeStore<Model, ActionsList, EventsList> => {
      const actions: Actions<Model, ActionsList> = options?.actions ?? (() => ({}) as ActionsList);
      const initialState = buildInitialState(schema);

      const store = create<Model & ActionsList>((set) => ({
        ...initialState,
        ...actions(
          set as (
            partial: Model | Partial<Model> | ((state: Model) => Model | Partial<Model>),
            replace?: false,
          ) => void,
        ),
      })) as NeoscopeStore<Model, ActionsList, EventsList>;

      store.schema = schema;
      store.initialState = () => buildInitialState(schema);
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

export type EventMap<T = any> = {
  [K in keyof T]: (...args: any[]) => void;
};
export type EventEmitter = (eventName: string, args: any[]) => void;

// --- Store extensions ---
interface StoreExtensions<Model extends Record<string, any>> {
  schema: ModelSchema;
  initialState: () => Model;
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

// ============================================================================
//    --- SCHEMA DEFINITION FOR NEOSCOPE STORES ---
// ============================================================================

export type Serializer<T> = (val: T) => any;
export type Deserializer<T> = (raw: any) => T;

export interface FieldDef<T = any> {
  readonly __kind: "field";
  default: T;
  serialize?: Serializer<T>;
  deserialize?: Deserializer<T>;
}

export interface SubModelDef<S extends ModelSchema = ModelSchema> {
  readonly __kind: "submodel";
  schema: S;
}

export interface RecordDef<S extends ModelSchema = ModelSchema> {
  readonly __kind: "record";
  itemSchema: S;
  default: Record<string, InferModel<S>>;
}

export type SchemaNode = FieldDef<any> | SubModelDef<any> | RecordDef<any>;
export type ModelSchema = { [key: string]: SchemaNode };

/** Declare a field in the model
 * @param defaultValue The default value for this field
 * @param opts Optional serialization/deserialization functions for this field
 * @returns A FieldDef object that can be used in a ModelSchema
 */
export function field<T>(
  defaultValue: T,
  opts?: { serialize?: Serializer<T>; deserialize?: Deserializer<T> },
): FieldDef<T> {
  return { __kind: "field", default: defaultValue, ...opts };
}

/** Declare a field referencing another model as a submodel
 * @param schema The schema of the submodel
 * @returns A SubModelDef object that can be used in a ModelSchema
 */
export function subModel<S extends ModelSchema>(schema: S): SubModelDef<S> {
  return { __kind: "submodel", schema };
}

/** Declare a field that is a dictionary of submodels, where each key maps to a submodel defined by itemSchema
 *
 * @param itemSchema
 * @param defaultValue
 * @returns
 */
export function recordOf<S extends ModelSchema>(
  itemSchema: S,
  defaultValue: Record<string, InferModel<S>> = {},
): RecordDef<S> {
  return { __kind: "record", itemSchema, default: defaultValue };
}

/** Automatic type inference for the state of a model based on its schema */
export type InferModel<S extends ModelSchema> = {
  [K in keyof S]: S[K] extends FieldDef<infer T>
    ? T
    : S[K] extends SubModelDef<infer Sub>
      ? InferModel<Sub>
      : S[K] extends RecordDef<infer Item>
        ? Record<string, InferModel<Item>>
        : never;
};

/** Automatic type inference for useNeoscopeStore of a Model schema */
export type UseModelSchema<S extends ModelSchema> = UseNeoscopeBoundStore<
  InferModel<S> & Actions<any, any> & EventMap<any>
>;

/** Resolve a schema node based on a path of keys. This function traverses the schema according to the provided path and returns the corresponding SchemaNode if found, or null if the path is invalid.
 * @param schema The root schema to start from
 * @param path An array of keys representing the path to traverse in the schema
 * @return The SchemaNode at the end of the path, or null if the path is invalid
 */
export function resolveSchemaNode(schema: ModelSchema, path: string[]): SchemaNode | null {
  let current: SchemaNode = { __kind: "submodel", schema };

  for (const segment of path) {
    if (current.__kind === "submodel") {
      const next: SchemaNode | undefined = current.schema[segment];
      if (!next) return null;
      current = next;
    } else if (current.__kind === "record") {
      // Le segment est une clé dynamique du dictionnaire -> le nœud enfant a la structure itemSchema
      current = { __kind: "submodel", schema: current.itemSchema };
    } else {
      return null; // On ne peut pas descendre sous une feuille
    }
  }
  return current;
}

// ============================================================================
//     --- FLATTENING / UPDATING STATE ---
// ============================================================================

/** Build the initial state of the zustand store based on the schema */
export function buildInitialState<S extends ModelSchema>(schema: S): InferModel<S> {
  const state: any = {};
  for (const [key, node] of Object.entries(schema)) {
    if (node.__kind === "field") {
      state[key] = structuredClone(node.default);
    } else if (node.__kind === "submodel") {
      state[key] = buildInitialState(node.schema);
    } else if (node.__kind === "record") {
      state[key] = structuredClone(node.default);
    }
  }
  return state;
}

/** Recursively deserialize a raw value according to the corresponding schema node */
export function deserializeNode(node: SchemaNode, rawValue: any): any {
  if (node.__kind === "field") {
    return node.deserialize ? node.deserialize(rawValue) : rawValue;
  }
  if (node.__kind === "submodel") {
    const base = buildInitialState(node.schema);
    if (rawValue && typeof rawValue === "object") {
      for (const [k, childNode] of Object.entries(node.schema) as [string, SchemaNode][]) {
        if (k in rawValue) {
          base[k] = deserializeNode(childNode, rawValue[k]);
        }
      }
    }
    return base;
  }
  if (node.__kind === "record") {
    const out: Record<string, any> = {};
    if (rawValue && typeof rawValue === "object") {
      const itemNode: SubModelDef<any> = { __kind: "submodel", schema: node.itemSchema };
      for (const [dictKey, dictRaw] of Object.entries(rawValue)) {
        out[dictKey] = deserializeNode(itemNode, dictRaw);
      }
    }
    return out;
  }
  return rawValue;
}

/** Recursively serialize a raw value according to the corresponding schema node */
export function serializeNode(node: SchemaNode, value: any): any {
  if (node.__kind === "field") {
    return node.serialize ? node.serialize(value) : value;
  }
  if (node.__kind === "submodel" && value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, childNode] of Object.entries(node.schema) as [string, SchemaNode][]) {
      if (k in value) {
        out[k] = serializeNode(childNode, value[k]);
      }
    }
    return out;
  }
  if (node.__kind === "record" && value && typeof value === "object") {
    const out: Record<string, any> = {};
    const itemNode: SubModelDef<any> = { __kind: "submodel", schema: node.itemSchema };
    for (const [dictKey, dictVal] of Object.entries(value)) {
      out[dictKey] = serializeNode(itemNode, dictVal);
    }
    return out;
  }
  return value;
}

/** Update a state with the given updates
 *
 * @param schema The schema of the model
 * @param currentState The current state of the model
 * @param updates A flat object containing the updates to apply, where keys are dot-separated paths in the model
 * @returns An object containing the next state and a boolean indicating if any changes were made.
 */
export function applyUpdates<S extends ModelSchema>(
  schema: S,
  currentState: InferModel<S>,
  updates: Record<string, any>,
): { nextState: InferModel<S>; hasChanges: boolean } {
  let nextState: any = { ...currentState };
  let hasChanges = false;

  for (const [flatKey, rawValue] of Object.entries(updates)) {
    if (flatKey === "__version__") continue;
    const parts = flatKey.split(".");
    const parentParts = parts.slice(0, -1);
    const targetKey = parts[parts.length - 1];

    // 1. Suppression explicite d'une clé dans un Record
    if (isDeletedMarker(rawValue)) {
      let curr: any = nextState;
      let valid = true;
      for (const p of parentParts) {
        if (!curr || typeof curr !== "object" || !(p in curr)) {
          valid = false;
          break;
        }
        curr[p] = { ...curr[p] };
        curr = curr[p];
      }
      if (valid && curr && targetKey in curr) {
        delete curr[targetKey];
        hasChanges = true;
      }
      continue;
    }

    // 2. Remplacement complet du nœud cible (feuille, submodel ou record)
    const targetNode = resolveSchemaNode(schema, parts);
    if (!targetNode) continue;

    const deserializedValue = deserializeNode(targetNode, rawValue);

    let currNew: any = nextState;
    let currOld: any = currentState;
    for (const p of parentParts) {
      currNew[p] = currNew[p] && typeof currNew[p] === "object" ? { ...currNew[p] } : {};
      currNew = currNew[p];
      currOld = currOld?.[p];
    }

    if (currOld?.[targetKey] !== deserializedValue) {
      currNew[targetKey] = deserializedValue;
      hasChanges = true;
    }
  }

  return { nextState, hasChanges };
}

/** Check if a value is a deleted marker */
function isDeletedMarker(value: any): boolean {
  return value?.__deleted__ === true;
}
const DELETED_MARKER = { __deleted__: true };

// ============================================================================
//     --- STATE DIFF COMPUTATION ---
// ============================================================================
/** Compute the difference between two states based on the schema, returning a flat object of updates
 * @param schema The schema of the model
 * @param prevState The previous state of the model
 * @param nextState The next state of the model
 * @param prefix A prefix for the keys in the diff (used for recursion)
 * @param diff An accumulator for the diff (used for recursion)
 * @returns A flat object containing the differences between prevState and nextState, where keys are dot-separated paths in the model
 */
export function computeStateDiff(
  schema: ModelSchema,
  prevState: any,
  nextState: any,
  prefix = "",
  diff: Record<string, any> = {},
): Record<string, any> {
  for (const [key, node] of Object.entries(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const prevVal = prevState?.[key];
    const nextVal = nextState?.[key];

    if (prevVal === nextVal) continue;

    if (node.__kind === "field") {
      diff[path] = serializeNode(node, nextVal);
    } else if (node.__kind === "submodel") {
      if (!prevVal || !nextVal) {
        diff[path] = serializeNode(node, nextVal);
      } else {
        computeStateDiff(node.schema, prevVal, nextVal, path, diff);
      }
    } else if (node.__kind === "record") {
      if (!prevVal || !nextVal) {
        diff[path] = serializeNode(node, nextVal);
      } else {
        const itemNode: SubModelDef<any> = { __kind: "submodel", schema: node.itemSchema };
        for (const dictKey of Object.keys(prevVal)) {
          if (!(dictKey in nextVal)) {
            diff[`${path}.${dictKey}`] = DELETED_MARKER;
          }
        }
        for (const dictKey of Object.keys(nextVal)) {
          if (!(dictKey in prevVal)) {
            diff[`${path}.${dictKey}`] = serializeNode(itemNode, nextVal[dictKey]);
          } else if (prevVal[dictKey] !== nextVal[dictKey]) {
            computeStateDiff(node.itemSchema, prevVal[dictKey], nextVal[dictKey], `${path}.${dictKey}`, diff);
          }
        }
      }
    }
  }
  return diff;
}
