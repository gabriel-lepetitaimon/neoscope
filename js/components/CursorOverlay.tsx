import * as React from "react";
import { CSSProperties } from "react";
import { asPoint, PointLike, Rect } from "../utils/geometry";
import { ZoomAreaState } from "../utils/zoom-area-controller";

interface CursorOverlayProps {
  sceneDomain: Rect;
  cursorPos: PointLike | null | (() => PointLike | null);
  transform: ZoomAreaState;
}

export default function CursorOverlay(props: CursorOverlayProps) {
  let relCursorPos = typeof props.cursorPos === "function" ? props.cursorPos() : props.cursorPos;
  const cursorPos = relCursorPos != null ? props.transform.scene2view(asPoint(relCursorPos)) : null;
  const svgStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
  } as CSSProperties;

  const cursor =
    cursorPos != null ? (
      <rect x={cursorPos.x} y={cursorPos.y} width={3} height={3} fill="white" stroke="grey" strokeWidth={1} />
    ) : null;
  return (
    <>
      <svg style={svgStyle}>{cursor}</svg>
    </>
  );
}
