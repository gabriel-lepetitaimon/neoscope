import { createAnywidgetRenderer } from "./anywidget";
import { createStreamlitRenderer } from "./streamlit";
import { NeoscopeStore } from "./zustand";
import "__FRAMEWORK_CSS__";

export type { NeoscopeStore } from "./zustand";
export { createNeoscopeStore } from "./zustand";

export function createNeoscopeRenderer<Model extends Record<string, any>, Actions extends Record<string, any>>(
  render: () => React.ReactNode,
  store: NeoscopeStore<Model, Actions>,
) {
  return {
    anywidget: () => createAnywidgetRenderer(render, store),
    streamlit: () => createStreamlitRenderer(render, store),
  }[__FRAMEWORK__]();
}
