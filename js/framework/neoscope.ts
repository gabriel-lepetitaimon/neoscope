import { Render } from "@anywidget/types";
import { createRoot, Root } from "react-dom/client";
import { StoreApi, UseBoundStore } from "zustand";
import { create } from "zustand";
import { FrontendRenderer, FrontendRendererArgs } from "@streamlit/component-v2-lib";

import "../css/neoscope.min.css";

interface NeoscopeAnyWidgetModel {
  _frontend_data: Record<string, any>;
}

interface StoreInitialStateAction<Model extends Record<string, any>> {
  initialState: () => Model;
}

type NeoscopeStore<Model extends Record<string, any>, Actions extends Record<string, any>> = UseBoundStore<
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

const reactRoots: WeakMap<FrontendRendererArgs["parentElement"], Root> = new WeakMap();

export function createNeoscopeRenderer<Model extends Record<string, any>, Actions extends Record<string, any>>(
  render: () => React.ReactNode,
  store: NeoscopeStore<Model, Actions>,
) {
  if (__FRAMEWORK__ === "anywidget") {
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
  } else if (__FRAMEWORK__ === "streamlit") {
    const renderHook: FrontendRenderer<Model, Model> = (args) => {
      const { data, parentElement, setStateValue } = args;

      const rootElement = parentElement.querySelector(".react-root");
      if (!rootElement) {
        throw new Error("Unexpected: React root element not found");
      }

      // Check to see if we already have a React root for this component instance.
      let reactRoot = reactRoots.get(parentElement);
      if (!reactRoot) {
        reactRoot = createRoot(rootElement);
        reactRoots.set(parentElement, reactRoot);
      }

      // Écoute les changements du Store React pour mettre à jour le Model Python
      const modelKeys = Object.keys(store.initialState()) as (keyof Model)[];
      const unsubscribe = store.subscribe((state) => {
        modelKeys.forEach((key) => {
          if (JSON.stringify(state[key]) !== JSON.stringify(data[key])) {
            console.log("Sending update:", key, "\n\told:", data[key], "\n\tnew:", state[key]);
            setStateValue(key, state[key]);
          }
        });
      });

      // Render/re-render the React application into the root using the React DOM
      // API.
      store.setState(data as Model);
      reactRoot.render(render());

      // Return a function to cleanup the React application in the Streamlit
      // component lifecycle.
      return () => {
        unsubscribe();

        const reactRoot = reactRoots.get(parentElement);
        if (reactRoot) {
          reactRoot.unmount();
          reactRoots.delete(parentElement);
        }
      };
    };
    return renderHook;
  }

  return () => console.log("Neoscope renderer called outside of anywidget framework!");
}
