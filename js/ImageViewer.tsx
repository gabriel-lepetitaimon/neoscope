import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/base";
import { useZoomTransform } from "./utils/zoom-area-controller";
import { Point, PointLike, Rect } from "./utils/geometry";
import { ImageStr, parseImageString } from "./utils/image";
import RulerAxis from "./components/RulerAxis";
import { useSceneMouseEventListener } from "./utils/zoom-area-events";

import "./css/ImageViewer.css";
import CursorOverlay from "./components/CursorOverlay";
import { createInstanciatedStore } from "./utils/zustand";

/*************************************************************************
 *  === ImageViewer MODEL ===
 *************************************************************************/
const _defaults = {
  image: { width: 0, height: 0, data: "" } as ImageStr,
};

const [createImageViewerStore, useImageViewerStore] = createNeoscopeStore(_defaults, {
  deserializers: {
    image: (bytes) => {
      console.log("deserializing image");
      return parseImageString(bytes);
    },
  },
});

type CursorStore = {
  cursorPos: PointLike | null;
  setCursorPos: (pos: PointLike | null) => void;
};
const useCursorStore = createInstanciatedStore<CursorStore>("ImageViewer.cursor", (set) => ({
  cursorPos: null,
  setCursorPos: (pos) => set({ cursorPos: pos }),
}));

/*************************************************************************
 *  === ImageViewer COMPONENT ===
 *************************************************************************/

const ImageViewer = () => {
  // --- STATE ---
  const { image } = useImageViewerStore();
  const { height, width, data } = image;
  const domain = new Rect(new Point(height, width));
  const showLeftRuler = true;
  const showTopRuler = true;

  // --- ZOOM CONTROLLER ---
  const [zoomState, zoomController, ref] = useZoomTransform(domain, 50);
  useSceneMouseEventListener(zoomController, undefined, useCursorStore.getState(0).setCursorPos);

  // --- SCENE TRANSFORM ---
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

  // --- RULERS ---
  const rulerProps = {
    thickness: 15,
    scale: () => zoomState.scale,
  };

  const widgetStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: showLeftRuler ? `${rulerProps.thickness}px 1fr` : "1fr",
    gridTemplateRows: showTopRuler ? `${rulerProps.thickness}px 1fr` : "1fr",
  };

  const topRuler = showTopRuler ? (
    <RulerAxis
      orientation={"horizontal"}
      center={() => t.center.x}
      cursorPos={() => useCursorStore(0, (state) => state.cursorPos?.x || null)}
      onPanCenter={(delta) => zoomController.panHorizontallyBy(delta)}
      onSetCenter={(x) => zoomController.setCenterX(x)}
      axisInterval={{ start: zoomState.sceneDomain.left, end: zoomState.sceneDomain.right }}
      style={{ gridRow: 1, gridColumn: showLeftRuler ? 2 : 1 }}
      {...rulerProps}
    />
  ) : null;

  const leftRuler = showLeftRuler ? (
    <RulerAxis
      orientation={"vertical"}
      center={() => t.center.y}
      cursorPos={() => useCursorStore(0, (state) => state.cursorPos?.y || null)}
      onPanCenter={(delta) => zoomController.panVerticallyBy(delta)}
      onSetCenter={(y) => zoomController.setCenterY(y)}
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

      <div
        ref={ref}
        className="ImageViewportContainer"
        style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: showLeftRuler ? 2 : 1, cursor: "crosshair" }}
      >
        <div className={"ImageViewport"}>
          <div style={sceneTransform}>
            <img
              src={data}
              style={{ width: "100%", height: "100%", imageRendering: pixelSize < 7 ? "auto" : "pixelated" }}
            />
          </div>
        </div>

        <CursorOverlay
          sceneDomain={zoomState.sceneDomain}
          cursorPos={() => useCursorStore(0, (state) => state.cursorPos || null)}
          transform={zoomState}
        />
      </div>
    </div>
  );
};

export default createNeoscopeRenderer(() => <ImageViewer />, createImageViewerStore, {
  maximizableHeight: true,
  resizeableHeight: 400,
});
