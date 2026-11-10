import React from "react";
import { createAnywidgetRenderer } from "./anywidget";
import { createStreamlitRenderer } from "./streamlit";
import { NeoscopeStore } from "./zustand";
import "__FRAMEWORK_CSS__";
import { ResizeHeightHandle } from "../components/resizable";

export type { NeoscopeStore } from "./zustand";
export { createNeoscopeStore } from "./zustand";

export interface WidgetRendererOpts {
  maximizableHeight?: boolean;
  resizeableHeight?: number;
}

export function createNeoscopeRenderer(
  render: () => React.ReactNode,
  store: NeoscopeStore<any, any>,
  opts?: WidgetRendererOpts,
) {
  const renderInContainer = () => <NeoscopeWidgetContainer opts={opts}>{render()}</NeoscopeWidgetContainer>;
  return {
    anywidget: () => createAnywidgetRenderer(renderInContainer, store),
    streamlit: () => createStreamlitRenderer(renderInContainer, store),
  }[__FRAMEWORK__]();
}

/* ==============================================================
    NeoscopeWidgetContainer
    A simple container component to wrap the widget content.
    It can be used to apply common styles or layout properties to the widget.
   ============================================================== */
interface NeoscopeWidgetContainerProps {
  opts?: WidgetRendererOpts;
  children: React.ReactNode; // Accepts any valid React child
}

function NeoscopeWidgetContainer({ opts, children }: NeoscopeWidgetContainerProps) {
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
    <div className={className} style={style}>
      {children}
      {resizeHandle}
    </div>
  );
}
