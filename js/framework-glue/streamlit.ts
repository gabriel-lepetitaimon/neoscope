import { FrontendRenderer, FrontendRendererArgs } from "@streamlit/component-v2-lib";
import { NeoscopeStore } from "./zustand";
import { createRoot, Root } from "react-dom/client";

const reactRoots: WeakMap<FrontendRendererArgs["parentElement"], Root> = new WeakMap();

export function createStreamlitRenderer<Model extends Record<string, any>, Actions extends Record<string, any>>(
  render: () => React.ReactNode,
  store: NeoscopeStore<Model, Actions>,
) {
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
