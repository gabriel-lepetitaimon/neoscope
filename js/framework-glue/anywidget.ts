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
) {
  const renderHook: Render<NeoscopeAnyWidgetModel> = ({ model, el }) => {
    function sendEvent(eventName: string, args: any[]) {
      console.log("Sending event to Python:", { event: { type: eventName, args } });
      model.send({ event: { type: eventName, args } });
    }

    // Create the store and the React root for this widget instance
    const store = createStore((eventName, eventArgs) => sendEvent(eventName, eventArgs));
    const root = createRoot(el);
    el.classList.add("neoscope-widget-root");

    // Listen to changes from the React store and update the Python model accordingly
    const modelKeys = Object.keys(store.initialState()) as (keyof Model)[];
    const unsubscribeStore = store.subscribe((state) => {
      const modelState: Model = modelKeys.reduce((acc, key) => {
        acc[key] = state[key];
        return acc;
      }, {} as Model);
      if (JSON.stringify(modelState) === JSON.stringify(model.get("_frontend_data"))) return;
      model.set("_frontend_data", modelState);
      model.save_changes();
      console.log("Updating Python model from React store:", modelState);
    });

    // Listen to changes from the Python model and update the React store accordingly
    function onPythonModelChange() {
      const data = model.get("_frontend_data");
      if (!data) return;
      let new_state: Partial<Model> = {};
      for (const key of Object.keys(data)) {
        if (!(key in store.initialState())) continue;
        let key_data = data[key];
        if (store.deserializers[key]) key_data = store.deserializers[key](key_data);
        new_state[key as keyof Model] = key_data;
      }
      console.log("Updating React store from Python model:", new_state);
      store.setState(new_state);
      root.render(render(store)); // Pass the store to the render function to expose it as Context
    }

    model.on("change:_frontend_data", onPythonModelChange);
    onPythonModelChange(); // Initial render with the current model state

    return () => {
      unsubscribeStore();
      model.off("change:_frontend_data", onPythonModelChange);
      root.unmount();
    };
  };
  return { render: renderHook };
}
