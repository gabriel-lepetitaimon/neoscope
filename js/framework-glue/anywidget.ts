import * as React from "react";
import { createRoot } from "react-dom/client";
import { Render } from "@anywidget/types";
import { NeoscopeStore } from "./zustand";

interface NeoscopeAnyWidgetModel {
  _frontend_data: Record<string, any>;
}

export function createAnywidgetRenderer<Model extends Record<string, any>, Actions extends Record<string, any>>(
  render: () => React.ReactNode,
  store: NeoscopeStore<Model, Actions>,
) {
  const renderHook: Render<NeoscopeAnyWidgetModel> = ({ model, el }) => {
    const root = createRoot(el);
    el.classList.add("neoscope-widget");

    function onPythonModelChange() {
      const data = model.get("_frontend_data");
      if (!data) return;
      store.setState(model.get("_frontend_data"));
      root.render(render());
    }

    // Écoute les changements du Store React pour mettre à jour le Model Python
    const modelKeys = Object.keys(store.initialState()) as (keyof Model)[];
    const unsubscribeStore = store.subscribe((state) => {
      const modelState: Model = modelKeys.reduce((acc, key) => {
        acc[key] = state[key];
        return acc;
      }, {} as Model);
      if (JSON.stringify(modelState) === JSON.stringify(model.get("_frontend_data"))) return;
      model.set("_frontend_data", modelState);
      model.save_changes();
    });

    // Écoute les changements venant de Python pour mettre à jour React
    model.on("change:_frontend_data", onPythonModelChange);

    // Premier rendu initial
    onPythonModelChange();

    return () => {
      unsubscribeStore();
      model.off("change:_frontend_data", onPythonModelChange);
      root.unmount();
    };
  };
  return { render: renderHook };
}
