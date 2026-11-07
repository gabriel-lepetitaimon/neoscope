import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/neoscope";
import { useZoomTransform } from "./utils/zoom-area-controller";
import { Point, Rect } from "./utils/geometry";
import { parseImageString } from "./utils/image";
import RulerAxis from "./components/RulerAxis";
import "./css/ImageViewerWidget.css";
import { useSceneMouseEventListener } from "./utils/zoom-area-events";
import { create } from "zustand";

const _defaults = {
  image: "",
};
type ImageViewerModel = typeof _defaults;

interface ImageViewerActions {}

const store = createNeoscopeStore<ImageViewerModel, ImageViewerActions>(_defaults, (set) => ({}));

type CursorStore = {
  cursorPos: Point | null;
  setCursorPos: (pos: Point | null) => void;
};
const cursorStore = create<CursorStore>((set) => ({
  cursorPos: null,
  setCursorPos: (pos) => set({ cursorPos: pos }),
}));

const ImageViewer = () => {
  const { image } = store();
  const { height, width, data } = parseImageString(image);
  const domain = new Rect(new Point(height, width));
  const showLeftRuler = true;
  const showTopRuler = true;

  const [zoomState, zoomController, ref] = useZoomTransform(domain, 50);
  useSceneMouseEventListener(zoomController, undefined, cursorStore.getState().setCursorPos);

  //console.log("ImageViewer render", { zoomState });

  // --- STYLE ---
  const rulerProps = {
    thickness: 15,
    scale: () => zoomState.scale,
  };

  const widgetStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: showLeftRuler ? `${rulerProps.thickness}px auto` : "auto",
    gridTemplateRows: showTopRuler ? `${rulerProps.thickness}px auto` : "auto",
  };

  const t = zoomState;
  const sceneSize = t.sceneDomain.size.multiply(zoomState.scale);
  const viewTopLeft = t.zoomArea.viewSize.half().subtract(t.center.subtract(t.sceneDomain.topLeft).multiply(t.scale));

  const sceneTransform: React.CSSProperties = {
    width: `${sceneSize.x}px`,
    height: `${sceneSize.y}px`,
    position: "absolute",
    left: `${viewTopLeft.x}px`,
    top: `${viewTopLeft.y}px`,
  };

  const topRuler = showTopRuler ? (
    <RulerAxis
      orientation={"horizontal"}
      center={() => t.center.x}
      cursorPos={() => {
        return cursorStore((state) => state.cursorPos?.x || null);
      }}
      onPanCenter={zoomController.panHorizontallyBy}
      onSetCenter={zoomController.setCenterX}
      axisInterval={{ start: zoomState.sceneDomain.left, end: zoomState.sceneDomain.right }}
      style={{ gridRow: 1, gridColumn: showLeftRuler ? 2 : 1 }}
      {...rulerProps}
    />
  ) : null;

  const leftRuler = showLeftRuler ? (
    <RulerAxis
      orientation={"vertical"}
      center={() => t.center.y}
      cursorPos={() => {
        return cursorStore((state) => state.cursorPos?.y || null);
      }}
      onPanCenter={zoomController.panVerticallyBy}
      onSetCenter={zoomController.setCenterY}
      axisInterval={{ start: zoomState.sceneDomain.top, end: zoomState.sceneDomain.bottom }}
      style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: 1 }}
      {...rulerProps}
    />
  ) : null;
  const pixelSize = (zoomState.scale * domain.width) / zoomState.sceneDomain.width;

  // --- RENDER ---
  return (
    <div className="ImageViewerWidget" style={widgetStyle}>
      {topRuler}
      {leftRuler}

      <div ref={ref} style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: showLeftRuler ? 2 : 1, cursor: "crosshair" }}>
        <div className={"ImageViewport"}>
          <div style={sceneTransform}>
            <img
              src={data}
              style={{ width: "100%", height: "100%", imageRendering: pixelSize < 7 ? "auto" : "pixelated" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default createNeoscopeRenderer(() => <ImageViewer />, store);
