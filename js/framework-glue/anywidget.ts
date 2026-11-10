import * as React from "react";
import { createRoot } from "react-dom/client";
import { Render } from "@anywidget/types";
import { NeoscopeStore, NeoscopeStoreFactory } from "./neoscopeStore";

interface NeoscopeAnyWidgetModel {
  _frontend_data: Record<string, any>;
}

export function createAnywidgetRenderer<Model extends Record<string, any>>(
  render: (store: NeoscopeStore<Model, any>) => React.ReactNode,
  createStore: NeoscopeStoreFactory<Model, any>,
  debounceMs: number = 50,
) {
  const renderHook: Render<NeoscopeAnyWidgetModel> = ({ model, el }) => {
    function sendEvent(eventName: string, args: any[]) {
      model.send({ event: { type: eventName, args } });
    }

    // Create the store and the React root for this widget instance
    const store = createStore((eventName, eventArgs) => sendEvent(eventName, eventArgs));
    const root = createRoot(el);
    el.classList.add("neoscope-widget-root");

    // Listen to changes from the React store and update the Python model accordingly
    let currentVersion: number = -1;
    let isUpdatingFromFrontend = false;
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasChangeDuringTimeout = false;

    const modelKeys = Object.keys(store.initialState()) as (keyof Model)[];
    const unsubscribeStore = store.subscribe((state) => {
      const currentData = model.get("_frontend_data") ?? {};
      const modelState: Record<string, any> = {};
      let hasChanged = false;

      for (const key of modelKeys) {
        const val = state[key];
        modelState[key as string] = val;
        if (JSON.stringify(val) !== JSON.stringify(currentData[key as string])) {
          hasChanged = true;
          break; // Exit early if any change is detected
        }
      }
      if (!hasChanged) return;

      // Incrémentation de la version locale
      currentVersion += 1;
      modelState.__version__ = currentVersion;

      isUpdatingFromFrontend = true;
      try {
        model.set("_frontend_data", modelState);
      } finally {
        isUpdatingFromFrontend = false;
      }

      // Debounce de l'envoi réseau vers Python
      if (!saveTimeout) {
        model.save_changes();
        saveTimeout = setTimeout(() => {
          if (hasChangeDuringTimeout) model.save_changes();
          hasChangeDuringTimeout = false;
          saveTimeout = null;
        }, debounceMs);
      } else {
        hasChangeDuringTimeout = true;
      }
    });

    // Listen to changes from the Python model and update the React store accordingly
    function onPythonModelChange() {
      if (isUpdatingFromFrontend) return;

      const data = model.get("_frontend_data");
      if (!data) return;

      const incomingVersion = data.__version__ ?? 0;
      if (incomingVersion <= currentVersion) return;
      currentVersion = incomingVersion;

      const currentState = store.getState();
      let new_state: Partial<Model> = {};
      let hasChanges = false;

      for (const key of Object.keys(data)) {
        if (!(key in store.initialState())) continue;
        let key_data = data[key];
        if (store.deserializers[key]) key_data = store.deserializers[key](key_data);

        if (currentState[key as keyof Model] !== key_data) {
          new_state[key as keyof Model] = key_data;
          hasChanges = true;
        }
      }
      if (!hasChanges) return;

      store.setState(new_state);
    }

    model.on("change:_frontend_data", onPythonModelChange);
    onPythonModelChange(); // Populate the store with the initial state from the Python model
    root.render(render(store)); // Render the React component with the appropriate store

    return () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      unsubscribeStore();
      model.off("change:_frontend_data", onPythonModelChange);
      root.unmount();
    };
  };
  return { render: renderHook };
}
