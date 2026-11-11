import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore, field } from "./framework-glue/base";
import { useZoomTransform, ZoomAreaController } from "./utils/zoom-area-controller";
import { useSceneMouseEventListener } from "./utils/zoom-area-events";
import { Point, PointLike, Rect } from "./utils/geometry";
import { ImageStr, parseImageString } from "./utils/image";
import RulerAxis from "./components/RulerAxis";

import "./css/ImageViewer.css";
import CursorOverlay from "./components/CursorOverlay";
import { createInstanciatedStore } from "./utils/zustand";

/*************************************************************************
 *  === ImageViewer MODEL ===
 *************************************************************************/
const Model = {
  image: field<ImageStr>({ width: 0, height: 0, data: "" }, { deserialize: (bytes) => parseImageString(bytes) }),
};
interface Events {
  onClick: (y: number, x: number) => void;
}

const [createImageViewerStore, useImageViewerStore] = createNeoscopeStore<Events>()(Model);

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
  // === UNPACK STATE ===
  const { image, onClick } = useImageViewerStore();
  const { height, width, data } = image;
  const domain = new Rect(new Point(height, width));
  const leftRuler = true;
  const topRuler = true;
  const cursorInstance = 0;

  // === USE ZOOM CONTROLLER ===
  const [zoomState, zoomController, ref] = useZoomTransform(domain, 50);
  useSceneMouseEventListener(
    zoomController,
    { onClick: (ev) => onClick(ev.cursor.y, ev.cursor.x) },
    useCursorStore.getState(cursorInstance).setCursorPos,
  );

  // --- Scene Transform ---
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
  const pixelSize = (zoomState.scale * domain.width) / zoomState.sceneDomain.width;

  // === RENDER ===
  const rulerProps: RulerProps = {
    thickness: 15,
    zoomController: zoomController,
    cursorInstance: cursorInstance,
  };

  return (
    <div
      className="ImageViewerWidget"
      style={{
        display: "grid",
        gridTemplateColumns: leftRuler ? `${rulerProps.thickness}px 1fr` : "1fr",
        gridTemplateRows: topRuler ? `${rulerProps.thickness}px 1fr` : "1fr",
      }}
    >
      {topRuler && <VerticalRuler style={{ gridRow: topRuler ? 2 : 1, gridColumn: 1 }} {...rulerProps} />}
      {leftRuler && <HorizontalRuler style={{ gridRow: 1, gridColumn: leftRuler ? 2 : 1 }} {...rulerProps} />}

      <div
        ref={ref}
        className="ImageViewportContainer"
        style={{ gridRow: topRuler ? 2 : 1, gridColumn: leftRuler ? 2 : 1, cursor: "crosshair" }}
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
          cursorPos={() => useCursorStore(cursorInstance, (state) => state.cursorPos || null)}
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

/*************************************************************************
 * === HORIZONTAL AND VERTICAL RULER ===
 *************************************************************************/
interface RulerProps {
  thickness: number;
  zoomController: ZoomAreaController;
  cursorInstance: number;
  style?: React.CSSProperties;
}
function HorizontalRuler({ thickness, zoomController, cursorInstance, style }: RulerProps) {
  return (
    <RulerAxis
      orientation={"horizontal"}
      center={() => zoomController.state.center.x}
      cursorPos={() => useCursorStore(cursorInstance, (state) => state.cursorPos?.x || null)}
      onPanCenter={(delta) => zoomController.panHorizontallyBy(delta)}
      onSetCenter={(x) => zoomController.setCenterX(x)}
      axisInterval={{ start: zoomController.state.sceneDomain.left, end: zoomController.state.sceneDomain.right }}
      style={style}
      thickness={thickness}
      scale={() => zoomController.state.scale}
    />
  );
}
function VerticalRuler({ thickness, zoomController, cursorInstance, style }: RulerProps) {
  return (
    <RulerAxis
      orientation={"vertical"}
      center={() => zoomController.state.center.y}
      cursorPos={() => useCursorStore(cursorInstance, (state) => state.cursorPos?.y || null)}
      onPanCenter={(delta) => zoomController.panVerticallyBy(delta)}
      onSetCenter={(y) => zoomController.setCenterY(y)}
      axisInterval={{ start: zoomController.state.sceneDomain.top, end: zoomController.state.sceneDomain.bottom }}
      style={style}
      thickness={thickness}
      scale={() => zoomController.state.scale}
    />
  );
}
