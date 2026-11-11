import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore, field } from "./framework-glue/base";
import { useZoomTransform, ZoomAreaController } from "./utils/zoom-area-controller";
import { useSceneMouseEventListener } from "./utils/zoom-area-events";
import { PointLike } from "./utils/geometry";
import RulerAxis from "./components/RulerAxis";

import "./css/ImageViewer.css";
import CursorOverlay from "./components/CursorOverlay";
import { createInstanciatedStore } from "./utils/zustand";
import { ModelSchema, recordOf } from "./framework-glue/neoscopeStore";
import { BaseLayer2DSchema, LayersRenderer } from "./layers-2d/base-layer";
import { fieldRect } from "./framework-glue/basic-fields";

/*************************************************************************
 *  === View2D MODEL ===
 *************************************************************************/
const Model: ModelSchema = {
  layers: recordOf(BaseLayer2DSchema),
  domain: fieldRect(),
  leftRuler: field(true),
  topRuler: field(true),
  syncCursor: field(0),
};

interface Events {
  onClick: (y: number, x: number) => void;
}

const [createView2DStore, useView2DModel] = createNeoscopeStore<Events>()(Model);

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

const View2D = () => {
  // === UNPACK STATE ===
  const onClick = useView2DModel((state) => state.onClick);
  const domain = useView2DModel((state) => state.domain);
  const leftRuler = useView2DModel((state) => state.leftRuler);
  const topRuler = useView2DModel((state) => state.topRuler);
  const syncCursor = useView2DModel((state) => state.syncCursor);

  // === USE ZOOM CONTROLLER ===
  const [zoomState, zoomController, ref] = useZoomTransform(domain, 50);
  useSceneMouseEventListener(
    zoomController,
    { onClick: (ev) => onClick(ev.cursor.y, ev.cursor.x) },
    useCursorStore.getState(syncCursor).setCursorPos,
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
  // const pixelSize = (zoomState.scale * domain.width) / zoomState.sceneDomain.width;

  // === RENDER ===
  const rulerProps: RulerProps = {
    thickness: 15,
    zoomController: zoomController,
    cursorInstance: syncCursor,
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
            <LayersRenderer layers={useView2DModel((state) => state.layers)} />
          </div>
        </div>

        <CursorOverlay
          sceneDomain={zoomState.sceneDomain}
          cursorPos={() => useCursorStore(syncCursor, (state) => state.cursorPos || null)}
          transform={zoomState}
        />
      </div>
    </div>
  );
};

export default createNeoscopeRenderer(() => <View2D />, createView2DStore, {
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
