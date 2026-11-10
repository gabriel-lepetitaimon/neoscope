import React from "react";
import { createAnywidgetRenderer } from "./anywidget";
import { createStreamlitRenderer } from "./streamlit";
import { NeoscopeStore, NeoscopeStoreContext, NeoscopeStoreFactory } from "./neoscopeStore";
import "__FRAMEWORK_CSS__";
import { ResizeHeightHandle } from "../components/resizable";

export type { NeoscopeStore, NeoscopeStoreFactory } from "./neoscopeStore";
export { createNeoscopeStore } from "./neoscopeStore";

export interface WidgetRendererOpts {
  maximizableHeight?: boolean;
  resizeableHeight?: number;
}

export function createNeoscopeRenderer<Model extends Record<string, any>>(
  render: () => React.ReactNode,
  createStore: NeoscopeStoreFactory<Model, any, any>,
  opts?: WidgetRendererOpts,
) {
  const renderWithStore = (store: NeoscopeStore<Model, any, any>) => (
    <NeoscopeWidgetContainer store={store} opts={opts}>
      {render()}
    </NeoscopeWidgetContainer>
  );
  return {
    anywidget: () => createAnywidgetRenderer(renderWithStore, createStore),
    streamlit: () => createStreamlitRenderer(renderWithStore, createStore),
  }[__FRAMEWORK__]();
}

/* ==============================================================
    NeoscopeWidgetContainer
    A simple container component to wrap the widget content.
    It can be used to apply common styles or layout properties to the widget.
   ============================================================== */
interface NeoscopeWidgetContainerProps {
  store: NeoscopeStore<any, any, any>;
  opts?: WidgetRendererOpts;
  children: React.ReactNode; // Accepts any valid React child
}

function NeoscopeWidgetContainer({ store, opts, children }: NeoscopeWidgetContainerProps) {
  let style: React.CSSProperties = {};
  let className = "neoscope-widget";
  if (opts?.maximizableHeight) className += " maximizable-height";

  let resizeHandle = null;
  const [height, setHeight] = React.useState(opts?.resizeableHeight ?? 0);
  if (opts?.resizeableHeight) {
    className += " resizable-height";
    resizeHandle = (
      <ResizeHeightHandle
        defaultHeight={opts.resizeableHeight}
        onHeightChange={setHeight}
        className="widget-height-handle"
      />
    );
    style["--widget-height"] = `${height}px`;
  }
  return (
    <NeoscopeStoreContext.Provider value={store}>
      <div className={className} style={style}>
        {children}
        {resizeHandle}
      </div>
    </NeoscopeStoreContext.Provider>
  );
}
