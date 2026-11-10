import { useEffect, useMemo } from "react";
import { Point } from "./geometry";
import { ZoomAreaController, ZoomAreaState } from "./zoom-area-controller";

export interface MouseEventsListener {
  onMouseDown?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  withMouseDownOrClick?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseUp?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseMove?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseEnter?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onMouseLeave?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onClick?: (ev: SceneMouseEvent, ctrls: ZoomControls) => void;
  onWheel?: (ev: SceneWheelEvent, ctrls: ZoomControls) => void;
}

export function useSceneMouseEventListener(
  zoomController: ZoomAreaController,
  userEvents?: MouseEventsListener,
  onCursorChange?: (cursor: Point | null) => void,
) {
  const events = useMemo((): MouseEventsListener => {
    // === DEFAULT USER EVENTS ===
    userEvents = userEvents || {
      onMouseDown: (ev, ctrls) => {
        if (ev.button === 0 || ev.button === 1) {
          ctrls.startPan(ev);
          onCursorChange?.(null);
        }
      },
      onWheel: (ev, ctrls) => {
        const delta = -ev.deltaY / 200;
        const zoomState = zoomController.state;
        if (delta < 0 && zoomState.isMinZoom()) {
          // If the user is zooming out but already at min zoom, pan towards the center
          const pan = zoomState.relativeCenter.subtract(0.5).clip_norm(-delta * 0.5);
          zoomController.panBy(pan.neg(), "relative", { duration: 200, cancelable: false });
        } else {
          ctrls.zoom(delta, ev.viewCursor, Math.abs(delta) >= 1);
        }
      },
    };

    // === MOUSE EVENTS ===
    return {
      onMouseDown: (ev, ctrls) => {
        userEvents?.onMouseDown?.(ev, ctrls);
        userEvents?.withMouseDownOrClick?.(ev, ctrls);
      },
      onMouseMove: (ev, ctrls) => {
        if (ctrls.panning && ctrls.lastEvent) ctrls.pan(ev.movementView.neg(), false, "view");
        else {
          onCursorChange?.(ev.cursor.floor());
          userEvents?.onMouseMove?.(ev, ctrls);
        }
      },
      onMouseUp: (ev, ctrls) => {
        if (ctrls.panning && ev.button === ctrls.initialEvent?.button) {
          ctrls.endPan();
          onCursorChange?.(ev.cursor.floor());
        } else userEvents?.onMouseUp?.(ev, ctrls);
      },
      onClick: (ev, ctrls) => {
        if (ctrls.panning && ev.button === ctrls.initialEvent?.button) ctrls.endPan();
        else userEvents?.onClick?.(ev, ctrls);
        userEvents?.withMouseDownOrClick?.(ev, ctrls);
      },
      onMouseEnter: (ev, ctrls) => {
        userEvents?.onMouseEnter?.(ev, ctrls);
        onCursorChange?.(ev.cursor.floor());
      },
      onMouseLeave: (ev, ctrls) => {
        if (ctrls.panning) ctrls.endPan();
        userEvents?.onMouseLeave?.(ev, ctrls);
        onCursorChange?.(null);
      },
      onWheel: userEvents?.onWheel,
    };
  }, [userEvents]);

  // === DISPATCH MOUSE EVENTS ===
  useEffect(() => {
    const area = zoomController.areaNode;
    if (!area) return;
    const zoomCtrls = new ZoomControls(zoomController, area);
    const zoomState = zoomController.state;

    // --- Wheel events ---
    const wheelEL = (ev: WheelEvent) => {
      if (events?.onWheel) {
        ev.preventDefault();
        events.onWheel(createSceneWheelEvent(ev, zoomState), zoomCtrls);
      }
    };

    // --- Mouse events ---
    const clickTimers: { [id: number]: ClickTimer | null } = {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
    };

    const mouseEL = (ev: MouseEvent) => {
      ev.preventDefault();
      const sceneMouseEvent = createSceneMouseEvent(ev, zoomState);
      const viewPos = sceneMouseEvent.cursorView;

      // A lot of complicated stuff to handle click vs drag events. The idea is to delay the onMouseDown event until we know if the user is dragging or clicking. If the user moves the mouse more than 5 pixels, we consider it a drag and fire the onMouseDown event. If the user releases the mouse button without moving more than 5 pixels, we consider it a click and fire the onClick event.
      const clickTimer = clickTimers[ev.button];
      if (ev.type === "mousemove") {
        if (clickTimer) {
          if (viewPos.subtract(clickTimer.startPos).norm() < 5) {
            clickTimer.lastPos = viewPos;
            return;
          }
          clearTimeout(clickTimer.timeout);
          clickTimers[ev.button] = null;
          events?.onMouseDown?.(clickTimer.mouseDownEvent, zoomCtrls);

          // Compute mouse movement from ignored event during timer
          const deltaView = clickTimer.lastPos.subtract(clickTimer.startPos);
          const delta = deltaView.divide(zoomState.scale);
          sceneMouseEvent.movementView = sceneMouseEvent.movementView.add(deltaView);
          sceneMouseEvent.cursorView = sceneMouseEvent.cursorView.add(deltaView);
          sceneMouseEvent.movement = sceneMouseEvent.movement.add(delta);
          sceneMouseEvent.cursor = sceneMouseEvent.cursor.add(delta);
        }
        events?.onMouseMove?.(sceneMouseEvent, zoomCtrls);
      } else if (ev.type === "mousedown") {
        if (clickTimer) {
          clearTimeout(clickTimer.timeout);
        }
        clickTimers[ev.button] = {
          startPos: viewPos,
          lastPos: viewPos,
          mouseDownEvent: sceneMouseEvent,
          timeout: setTimeout(() => {
            const c = clickTimers[ev.button];
            if (c) {
              clickTimers[ev.button] = null;
              events?.onMouseDown?.(c.mouseDownEvent, zoomCtrls);

              // Compute mouse movement from ignored event during timer
              const deltaView = c.lastPos.subtract(c.startPos);
              const delta = deltaView.divide(zoomState.scale);
              sceneMouseEvent.movementView = deltaView;
              sceneMouseEvent.cursorView = sceneMouseEvent.cursorView.add(deltaView);
              sceneMouseEvent.movement = delta;
              sceneMouseEvent.cursor = sceneMouseEvent.cursor.add(delta);
              events?.onMouseMove?.(sceneMouseEvent, zoomCtrls);
            }
          }, 750),
        };
      } else if (ev.type === "mouseup") {
        if (clickTimer) {
          clearTimeout(clickTimer.timeout);
          clickTimers[ev.button] = null;
          events?.onClick?.(sceneMouseEvent, zoomCtrls);
        } else {
          events?.onMouseUp?.(sceneMouseEvent, zoomCtrls);
        }
      } else if (ev.type === "mouseenter") events?.onMouseEnter?.(sceneMouseEvent, zoomCtrls);
      else if (ev.type === "mouseleave") events?.onMouseLeave?.(sceneMouseEvent, zoomCtrls);
    };

    area.addEventListener("mousedown", mouseEL);
    area.addEventListener("mouseup", mouseEL);
    area.addEventListener("mousemove", mouseEL);
    area.addEventListener("mouseenter", mouseEL);
    area.addEventListener("mouseleave", mouseEL);

    area.addEventListener("wheel", wheelEL, { passive: false });

    return () => {
      area.removeEventListener("mousedown", mouseEL);
      area.removeEventListener("mouseup", mouseEL);
      area.removeEventListener("mousemove", mouseEL);
      area.removeEventListener("mouseenter", mouseEL);
      area.removeEventListener("mouseleave", mouseEL);
      area.removeEventListener("wheel", wheelEL);
    };
  }, [zoomController, zoomController.areaNode, events]);
}

// =========================================================================
//          --- SCENE MOUSE EVENT Listener ---
// =========================================================================
class ZoomControls {
  public panning = false;
  public initialEvent: SceneMouseEvent | undefined = undefined;
  public lastEvent: SceneMouseEvent | undefined = undefined;

  constructor(
    protected controller: ZoomAreaController,
    protected area: HTMLElement,
    protected onCursorChange?: (cursor: Point | null) => void,
  ) {}

  startPan(ev: SceneMouseEvent): void {
    this.area?.requestPointerLock();
    this.onCursorChange?.(null);
    this.panning = true;
    this.lastEvent = ev;
    this.initialEvent = ev;
  }

  endPan(): void {
    document.exitPointerLock();
    this.panning = false;
    this.lastEvent = undefined;
    this.initialEvent = undefined;
  }

  pan(translate: Point, animate: boolean = false, coord: "view" | "scene" = "view"): void {
    if (translate.isZero()) return;
    this.controller.panBy(translate, coord, animate ? { duration: 200, cancelable: false } : undefined);
  }

  zoom(factor: number, center?: Point, animate: boolean = false): void {
    this.controller.zoomBy(factor, center, "view", animate ? { duration: 200, cancelable: false } : undefined);
  }
}

// =========================================================================
//          --- SCENE MOUSE EVENT ---
// =========================================================================
interface BaseMouseEvent {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  button: number;
  buttons: number;
}

function createBaseMouseEvent(ev: MouseEvent | WheelEvent): BaseMouseEvent {
  return {
    altKey: ev.altKey,
    ctrlKey: ev.ctrlKey,
    shiftKey: ev.shiftKey,
    metaKey: ev.metaKey,
    button: ev.button,
    buttons: ev.buttons,
  };
}

export interface SceneMouseEvent extends BaseMouseEvent {
  cursor: Point;
  cursorView: Point;
  movement: Point;
  movementView: Point;
}

function createSceneMouseEvent(ev: MouseEvent, zoomAreaState: ZoomAreaState): SceneMouseEvent {
  const viewCursor = zoomAreaState.client2view(new Point(ev.y, ev.x));
  const sceneEv = {
    ...createBaseMouseEvent(ev),
    cursor: zoomAreaState.view2scene(viewCursor),
    cursorView: viewCursor,
    movement: new Point(ev.movementY, ev.movementX).divide(zoomAreaState.scale),
    movementView: new Point(ev.movementY, ev.movementX),
  };
  return sceneEv;
}

export interface SceneWheelEvent extends BaseMouseEvent {
  cursor: Point;
  viewCursor: Point;
  deltaX: number;
  deltaY: number;
}

function createSceneWheelEvent(ev: WheelEvent, zoomAreaState: ZoomAreaState): SceneWheelEvent {
  let { deltaX, deltaY } = ev;
  // Normalize deltaX, deltaY across browsers
  switch (ev.deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL:
      // Nothing to do
      break;
    case WheelEvent.DOM_DELTA_LINE:
      deltaX *= 16;
      deltaY *= 16;
      break;
    case WheelEvent.DOM_DELTA_PAGE:
      deltaX *= 800;
      deltaY *= 800;
      break;
  }
  const viewCursor = zoomAreaState.client2view(ev.y, ev.x);
  return {
    ...createBaseMouseEvent(ev),
    cursor: zoomAreaState.view2scene(viewCursor),
    viewCursor,
    deltaX,
    deltaY,
  };
}

type Timeout = ReturnType<typeof setTimeout>;

interface ClickTimer {
  timeout: Timeout;
  startPos: Point;
  lastPos: Point;
  mouseDownEvent: SceneMouseEvent;
}
