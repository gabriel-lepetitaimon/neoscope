import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework/neoscope";
import { SceneMouseEvent, Transform, useSceneMouseEventListener, useZoomTransform } from "./utils/zoom-pan-handler";
import { Point, Rect } from "./utils/geometry";
import { parseImageString } from "./utils/image";
import RulerAxis from "./components/RulerAxis";
import "./css/ImageViewerWidget.css";
import "./css/neoscope.min.css";

const _defaults = {
  image: "",
};
type ImageViewerModel = typeof _defaults;

interface ImageViewerActions {}

const store = createNeoscopeStore<ImageViewerModel, ImageViewerActions>(_defaults, (set) => ({}));

const ImageViewer = () => {
  const { image } = store();
  const { height, width, data } = parseImageString(image);
  const domain = new Rect(new Point(height, width));
  const showLeftRuler = true;
  const showTopRuler = true;

  const ref = React.useRef<HTMLDivElement>(null);
  const zoomTransform = useZoomTransform(ref, domain, 50);
  const cursorPos = useSceneMouseEventListener(zoomTransform);

  const panHorizontally = (delta: number): void => {
    zoomTransform.dispatch({
      pan: new Point(delta, 0),
    });
  };
  const panVertically = (delta: number): void => {
    zoomTransform.dispatch({
      pan: new Point(0, delta),
    });
  };

  const setCenterHorizontally = (center: number): void => {
    zoomTransform.dispatch({
      center: new Point(zoomTransform.center.y, center),
    });
  };
  const setCenterVertically = (center: number): void => {
    zoomTransform.dispatch({
      center: new Point(center, zoomTransform.center.x),
    });
  };

  // --- STYLE ---
  const rulerProps = {
    thickness: 15,
    scale: () => zoomTransform.scale,
  };

  const widgetStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: showLeftRuler ? `${rulerProps.thickness}px auto` : "auto",
    gridTemplateRows: showTopRuler ? `${rulerProps.thickness}px auto` : "auto",
  };

  const t = zoomTransform;
  const sceneSize = t.sceneDomain.size.multiply(zoomTransform.scale);
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
      cursorPos={() => cursorPos?.x || null}
      onPanCenter={panHorizontally}
      onSetCenter={setCenterHorizontally}
      axisInterval={{ start: zoomTransform.sceneDomain.left, end: zoomTransform.sceneDomain.right }}
      style={{ gridRow: 1, gridColumn: showLeftRuler ? 2 : 1 }}
      {...rulerProps}
    />
  ) : null;

  const leftRuler = showLeftRuler ? (
    <RulerAxis
      orientation={"vertical"}
      center={() => t.center.y}
      cursorPos={() => cursorPos?.y || null}
      onPanCenter={panVertically}
      onSetCenter={setCenterVertically}
      axisInterval={{ start: zoomTransform.sceneDomain.top, end: zoomTransform.sceneDomain.bottom }}
      style={{ gridRow: showTopRuler ? 2 : 1, gridColumn: 1 }}
      {...rulerProps}
    />
  ) : null;
  const pixelSize = (zoomTransform.scale * domain.width) / zoomTransform.sceneDomain.width;

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
