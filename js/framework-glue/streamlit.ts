import { FrontendRenderer, FrontendRendererArgs } from "@streamlit/component-v2-lib";
import { NeoscopeStore, NeoscopeStoreFactory } from "./zustand";
import { createRoot, Root } from "react-dom/client";

interface StreamlitInstance<Model extends Record<string, any>> {
  root: Root;
  store: NeoscopeStore<Model, any>;
  unsubscribe?: () => void;
}

const instances: WeakMap<FrontendRendererArgs["parentElement"], StreamlitInstance<any>> = new WeakMap();

export function createStreamlitRenderer<Model extends Record<string, any>>(
  render: (store: NeoscopeStore<Model, any>) => React.ReactNode,
  createStore: NeoscopeStoreFactory<Model, any>,
) {
  const renderHook: FrontendRenderer<Model, Model> = (args) => {
    const { data, parentElement, setStateValue } = args;

    const rootElement = parentElement.querySelector(".react-root");
    if (!rootElement) {
      throw new Error("Unexpected: React root element not found");
    }

    // Get or create the Streamlit instance for this parentElement
    let instance = instances.get(parentElement);
    if (!instance) {
      instance = {
        root: createRoot(rootElement),
        store: createStore(), // The store is isolated to this widget instance
      };
      instances.set(parentElement, instance);
    }
    if (instance.unsubscribe) instance.unsubscribe(); // Cleanup previous subscription if it exists

    const { root, store } = instance;

    // Subscribe to store changes and send updates back to Python when the store state changes
    const modelKeys = Object.keys(store.initialState()) as (keyof Model)[];
    instance.unsubscribe = store.subscribe((state) => {
      modelKeys.forEach((key) => {
        if (JSON.stringify(state[key]) !== JSON.stringify(data[key])) {
          console.log("Sending update:", key, "\n\told:", data[key], "\n\tnew:", state[key]);
          setStateValue(key, state[key]);
        }
      });
    });

    // Compute the new state based on the incoming data and the store's deserializers
    const new_state: Partial<Model> = {};
    for (const key of Object.keys(data)) {
      if (!(key in store.initialState())) continue;
      let key_data = data[key];
      if (store.deserializers[key]) key_data = store.deserializers[key](key_data);
      new_state[key as keyof Model] = key_data;
    }
    console.log("Received update:", new_state);
    store.setState(new_state);

    // Render the React component with the appropriate store
    root.render(render(store));

    // Return a function to cleanup the React application in the Streamlit
    // component lifecycle.
    return () => {
      const currentInstance = instances.get(parentElement);
      if (currentInstance) {
        currentInstance.unsubscribe?.();
        currentInstance.root.unmount();
        instances.delete(parentElement);
      }
    };
  };
  return renderHook;
}
