import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { Animation, Animator, EasingFunction } from "./animator";
import { ORIGIN, Point, Rect, Transform, isSameTransform } from "./geometry";

export function useZoomTransform(
  sceneDomain: Rect,
  maxScale: number,
  sceneOuterRect?: Rect,
): [ZoomAreaState, ZoomAreaController, (node: HTMLElement | null) => void] {
  // === INITIALIZE STATE AND CONTROLLER ===
  // Trigger to manually redraw the area
  const [, redraw] = useReducer((c) => c + 1, 0);
  // Internal controller and state (as ref to manually control when re-render should occur)
  const controllerRef = useRef<ZoomAreaController | null>(null);
  if (controllerRef.current === null) {
    // Initialize the controller only once
    controllerRef.current = new ZoomAreaController(
      new ZoomAreaState(new ZoomAreaCalculator(sceneDomain, maxScale, sceneOuterRect)),
      redraw,
    );
  }
  const controller = controllerRef.current;

  // === SETUP AREA  ===
  controller.setAreaProperties(sceneDomain, maxScale, sceneOuterRect);
  const areaRefCallback = useCallback(
    (node: HTMLElement | null) => {
      if (controller.areaNode !== node) controller.setAreaNode(node);
    },
    [controller],
  );

  // Setup ResizeObserver to update the clientRect of the zoom area when the area size changes
  useLayoutEffect(() => {
    if (!controller.areaNode) return;

    const updateRect = () => controller.updateClientRect();

    // 1. Observe les changements de taille de l'élément lui-même
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(controller.areaNode);

    // 2. Observe le défilement (scroll) global
    // Le paramètre { capture: true } permet de détecter le scroll même dans les conteneurs parents
    window.addEventListener("scroll", updateRect, { capture: true, passive: true });
    window.addEventListener("resize", updateRect);

    // Nettoyage des écouteurs à la destruction du composant
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateRect, { capture: true });
      window.removeEventListener("resize", updateRect);
    };
  }, [controller.areaNode, controller]);

  return [controller.state, controller, areaRefCallback];
}

export type Coord = "view" | "scene" | "relative" | "client";

// =========================================================================
//          === ZOOM AREA CALCULATOR ===
// =========================================================================
/**
 * Utility class to perform calculations for a zoomable area.
 * Given the view and scene dimensions, this class provides methods to calculate zoom levels,
 * coordinate conversions, and constraints for a zoomable area.
 *
 * It does not maintain any state about the current view transform.
 */
class ZoomAreaCalculator {
  protected _clientRect: Rect = Rect.EMPTY;
  protected _maxZoom?: number; // cache: scale2zoom(maxScale)
  protected _minScale?: number; // cache: min(viewSize.size / sceneRect.size)
  protected _minZoom?: number; // cache: scale2zoom(minScale)
  protected _defaultScale?: number; // cache: viewSize.size / sceneMainDomain.size
  protected _relativeSceneBoundaries?: Rect; // cache: sceneRect relative to sceneMainDomain

  /**
   * Create a ZoomAreaState to handle zoom and pan operations
   * @param _clientRect: size of the view in screen coordinates
   * @param _sceneDomain: domain of the scene in scene coordinates
   * @param _maxScale: maximum number of screen pixel for a single unit of scene coordinates
   * @param _sceneOuterRect: bounding rectangle of the scene in scene coordinates (of not provided uses sceneDomain)
   */
  constructor(
    protected _sceneDomain: Rect,
    protected _maxScale: number,
    protected _sceneOuterRect?: Rect,
  ) {}

  // === Zoom Area Properties ===
  public get viewSize(): Point {
    return this._clientRect.size;
  }

  public get clientRect(): Rect {
    return this._clientRect;
  }

  public setClientRect(clientRect: Rect): boolean {
    if (clientRect.equals(this._clientRect)) return false;
    const sameSize = clientRect.size.equals(this._clientRect.size);
    if (!sameSize) this.invalidateScaleCaches();

    this._clientRect = clientRect;
    return !sameSize;
  }

  public get sceneDomain(): Rect {
    return this._sceneDomain;
  }
  public setSceneDomain(p: Rect): boolean {
    if (p.equals(this._sceneDomain)) return false;
    this._sceneDomain = p;
    this.invalidateScaleCaches();
    return true;
  }

  public get sceneOuterRect(): Rect {
    if (this._sceneOuterRect && !this._sceneOuterRect.isEmpty()) {
      return this._sceneOuterRect;
    }
    return this._sceneDomain;
  }

  public setSceneOuterRect(p: Rect | null): boolean {
    if (p === null || p.isEmpty()) {
      if (this._sceneOuterRect === undefined) return false;
      this._sceneOuterRect = undefined;
    } else {
      if (this._sceneOuterRect !== undefined && p.equals(this._sceneOuterRect)) return false;
      this._sceneOuterRect = p;
    }
    this.invalidateScaleCaches();
    return true;
  }

  public get maxScale(): number {
    return this._maxScale;
  }

  public setMaxScale(s: number): boolean {
    if (s === this._maxScale) return false;
    if (s <= 0) throw new Error("maxScale must be positive");
    this._maxScale = s;
    this._maxZoom = undefined;
    return true;
  }

  // === Zoom Area Scale Properties Caches ===
  protected invalidateScaleCaches() {
    this._minScale = undefined;
    this._minZoom = undefined;
    this._defaultScale = undefined;
    this._maxZoom = undefined;
    this._relativeSceneBoundaries = undefined;
  }

  public get minScale(): number {
    if (this._minScale === undefined) {
      if (this.sceneOuterRect.isEmpty()) {
        return 1;
      }
      this._minScale = Math.min(this.viewSize.divide(this.sceneOuterRect.size).min() + 1e-8, this.maxScale);
    }
    return this._minScale;
  }

  public get minZoom(): number {
    if (this._minZoom === undefined) {
      if (this.sceneOuterRect.isEmpty()) {
        return 0;
      }
      this._minZoom = this.scale2zoom(this.minScale);
    }
    return this._minZoom;
  }

  public get defaultScale(): number {
    if (this._defaultScale === undefined) {
      if (this.sceneDomain.isEmpty() || this.viewSize.hasZero()) {
        return 1;
      } else {
        this._defaultScale = this.viewSize.divide(this.sceneDomain.size).min() + 1e-8;
      }
    }
    return this._defaultScale;
  }

  public get relativeSceneBoundaries(): Rect {
    // sceneRect in relative coordinates (i.e. relative to sceneDefaultRect)
    if (this._relativeSceneBoundaries === undefined) {
      this._relativeSceneBoundaries = this.sceneOuterRect
        .translate(this.sceneDomain.topLeft.neg())
        .scale(this.sceneDomain.size.inv());
    }
    return this._relativeSceneBoundaries;
  }

  public get maxZoom(): number {
    if (this._maxZoom === undefined) {
      this._maxZoom = this.scale2zoom(this._maxScale);
    }
    return this._maxZoom;
  }

  // === Coordinates system conversions ===
  public scale2zoom(s: number): number {
    return Math.log2(s / this.defaultScale);
  }

  public zoom2scale(z: number): number {
    return Math.pow(2, z) * this.defaultScale;
  }

  public scene2relative(p: Point): Point;
  public scene2relative(p: Rect): Rect;
  public scene2relative(p: unknown): unknown {
    if (p instanceof Point) {
      return this.sceneDomain.isEmpty()
        ? new Point(0.5, 0.5)
        : p.subtract(this.sceneDomain.topLeft).divide(this.sceneDomain.size);
    } else if (p instanceof Rect) {
      return this.sceneDomain.isEmpty()
        ? Rect.unitary()
        : p.translate(this.sceneDomain.topLeft.neg()).scale(this.sceneDomain.size.inv());
    }
    throw new Error("Invalid argument type: p must be Point or Rect");
  }

  public relative2scene(p: Point): Point;
  public relative2scene(p: Rect): Rect;
  public relative2scene(p: Point | Rect): Point | Rect {
    if (p instanceof Point) {
      return p.multiply(this.sceneDomain.size).add(this.sceneDomain.topLeft);
    } else if (p instanceof Rect) {
      return p.scale(this.sceneDomain.size).translate(this.sceneDomain.topLeft);
    }
    throw new Error("Invalid argument type: p must be Point or Rect");
  }

  public centerInSceneCoord(t: Transform): Point {
    return t.coord === "relative" ? this.relative2scene(t.center) : t.center;
  }

  public centerInRelativeCoord(t: Transform): Point {
    return t.coord === "relative" ? t.center : this.scene2relative(t.center);
  }

  public relativeTransform(t: Transform): Transform {
    return t.coord === "relative"
      ? t
      : {
          zoom: t.zoom,
          center: this.scene2relative(t.center),
          coord: "relative",
        };
  }

  public toRelativeCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toRelativeCoord(p: Rect, t: Transform, coord?: Coord): Rect;
  public toRelativeCoord(p: Point | Rect, t: Transform, coord?: Coord): Point | Rect {
    if (p instanceof Point) {
      if (coord === "client") {
        p = p.subtract(this._clientRect.topLeft); // Convert client to view coordinates
        coord = "view";
      }

      switch (coord) {
        case "view":
          if (this.sceneDomain.isEmpty()) return new Point(0.5, 0.5);

          return p
            .subtract(this.viewSize.divide(2)) // Center on the view center
            .divide(this.zoom2scale(t.zoom)) // Scale to scene coordinate
            .divide(this.sceneDomain.size) // Scale to relative coordinate (relative to sceneDefaultRect)
            .add(this.centerInRelativeCoord(t)); // Translate accordingly to the scene center

        case "relative":
          return p;

        default: // case 'scene'
          return this.scene2relative(p);
      }
    } else if (p instanceof Rect) {
      return new Rect(
        this.toRelativeCoord(p.topLeft, t, coord) as Point,
        this.toRelativeCoord(p.bottomRight, t, coord) as Point,
      );
    }
    throw new Error("Invalid argument type: p must be Point or Rect");
  }

  public toSceneCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toSceneCoord(p: Rect, t: Transform, coord?: Coord): Rect;
  public toSceneCoord(p: Point | Rect, t: Transform, coord?: Coord): Point | Rect {
    if (p instanceof Point) {
      if (coord === "client") {
        p = p.subtract(this._clientRect.topLeft); // client to view coordinates
        coord = "view";
      }

      switch (coord) {
        case "view":
          return p
            .subtract(this.viewSize.divide(2)) // Center on the view center
            .divide(this.zoom2scale(t.zoom)) // Scale to scene coordinate
            .add(this.centerInSceneCoord(t)); // Translate accordingly to the scene center
        case "relative":
          return this.relative2scene(p);
        default: // case 'scene'
          return p;
      }
    } else {
      return new Rect(
        this.toSceneCoord(p.topLeft, t, coord) as Point,
        this.toSceneCoord(p.bottomRight, t, coord) as Point,
      );
    }
  }

  public toViewCoord(p: Point, t: Transform, coord?: Coord): Point;
  public toViewCoord(p: Rect, t: Transform, coord?: Coord): Rect;
  public toViewCoord(p: Point | Rect, t: Transform, coord?: Coord): Point | Rect {
    if (p instanceof Point) {
      if (coord === "view") return p;
      if (coord === "client") return p.subtract(this._clientRect.topLeft);

      if (coord === "relative") p = this.toSceneCoord(p, t, "relative") as Point; // relative to scene coordinates
      return (p as Point)
        .subtract(this.centerInSceneCoord(t)) // Center on the scene center
        .multiply(this.zoom2scale(t.zoom)) // Scale to view coordinate
        .add(this.viewSize.divide(2)); // Translate accordingly to the view center
    } else {
      return new Rect(
        this.toViewCoord(p.topLeft, t, coord) as Point,
        this.toViewCoord(p.bottomRight, t, coord) as Point,
      );
    }
  }

  public transform2VisibleArea(t: Transform): Rect {
    return Rect.fromCenter(this.centerInSceneCoord(t), this.viewSize.divide(this.zoom2scale(t.zoom)));
  }

  public visibleArea2Transform(visibleArea: Rect, coord: "scene" | "relative" = "scene"): Transform {
    let center = visibleArea.center;
    let visibleSize = visibleArea.size;
    if (coord === "relative")
      // If visibleArea is in relative coordinates
      visibleSize = visibleSize.multiply(this.sceneDomain.size);
    // Cast visibleSize to scene coordinates
    // If visibleArea is in scene coordinates
    else center = this.scene2relative(center); // Cast center to relative coordinates

    return {
      zoom: this.scale2zoom(this.viewSize.divide(visibleSize).min()),
      center: center,
      coord: "relative",
    };
  }

  // === Constraint Safeguards ===
  public constraintZoom(zoom: number): number {
    return Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
  }

  public constraintCenter(transform: Transform, previousCenter?: Point): Transform {
    const center = transform.center;
    if (isNaN(transform.center.x) || isNaN(transform.center.y) || this.sceneOuterRect.isEmpty()) {
      return { ...transform, center: ORIGIN };
    }
    const scale = this.zoom2scale(transform.zoom);
    const pad = this.viewSize.divide(2 * scale).clip(this.sceneOuterRect.size.divide(2));
    let centerBoundaries =
      transform.coord === "relative"
        ? this.relativeSceneBoundaries.pad(pad.divide(this.sceneDomain.size))
        : this.sceneOuterRect.pad(pad);
    if (previousCenter) centerBoundaries = centerBoundaries.union(previousCenter);
    return { ...transform, center: center.clip(centerBoundaries) };
  }

  public constraintTransform(t: Transform): Transform {
    const zoom = this.constraintZoom(t.zoom);
    return this.constraintCenter({ ...t, zoom: zoom });
  }

  public applyZoom(t: Transform, dZoom: number, zoomCenter?: Point, coord: Coord = "scene"): Transform {
    const newZoom = this.constraintZoom(t.zoom + dZoom);
    dZoom = newZoom - t.zoom;
    if (dZoom === 0) {
      return t;
    }

    // If the zoom center is different from the view center, we need to translate the scene.
    if (zoomCenter) {
      let center = this.centerInSceneCoord(t);
      let dCenter: Point; // Translation value
      if (coord === "client") {
        zoomCenter = zoomCenter.subtract(this._clientRect.topLeft); // Convert client to view coordinates
        coord = "view";
      }
      if (coord === "view") {
        dCenter = zoomCenter
          .subtract(this.viewSize.divide(2)) // Center on the view center
          .multiply(1 / this.zoom2scale(t.zoom) - 1 / this.zoom2scale(newZoom)); // Scale translation according to the zoom delta
      } else {
        if (coord === "relative") zoomCenter = this.relative2scene(zoomCenter); // Cast zoomCenter to scene coordinates

        dCenter = zoomCenter
          .subtract(center) // Center on the view center (in scene coordinates)
          .multiply(1 - Math.pow(2, -dZoom)); // Scale translation according to the zoom delta
      }

      return {
        center: center.add(dCenter),
        zoom: newZoom,
      };
    } else {
      return this.constraintCenter({ ...t, zoom: newZoom });
    }
  }
}

// =========================================================================
//          === ZOOM AREA INTERNAL STATE ===
// =========================================================================
/**
 * Internal state of a ZoomAreaController
 * This class is used internally by ZoomAreaController to keep track of the current transform and scale.
 * It also provides methods to convert between different coordinate systems.
 */
export class ZoomAreaState {
  protected _t: Transform = { center: new Point(0.5, 0.5), zoom: 0, coord: "relative" }; // Cache of last known transform
  protected _scale: number = 1; // Cache of last known scale factor
  public animator: Animator<"center" | "zoom">;
  public animTarget?: Transform;

  constructor(public zoomArea: ZoomAreaCalculator) {
    this.animator = new Animator<"center" | "zoom">({
      onStop: () => (this.animTarget = undefined),
    });
  }

  // === Internal State Properties ===
  get transform(): Transform {
    return this._t;
  }

  set transform(t: Transform) {
    this.setTransform(t);
  }

  setTransform(t: Transform, assume_different: boolean = false): boolean {
    if (!assume_different && isSameTransform(t, this._t)) return false;
    this._t = t;
    this._scale = this.zoomArea.zoom2scale(t.zoom);
    return true;
  }

  get scale(): number {
    return this._scale;
  }

  get zoom(): number {
    return this._t.zoom;
  }

  get center(): Point {
    return this.zoomArea.centerInSceneCoord(this._t);
  }

  get relativeCenter(): Point {
    return this.zoomArea.centerInRelativeCoord(this._t);
  }

  get sceneDomain(): Rect {
    return this.zoomArea.sceneDomain;
  }

  isMinZoom(): boolean {
    return this._t.zoom <= this.zoomArea.minZoom;
  }

  isMaxZoom(): boolean {
    return this._t.zoom >= this.zoomArea.maxZoom;
  }

  get sceneRect(): Rect {
    return this.zoomArea.sceneOuterRect;
  }

  get viewOffset(): Point {
    return this.zoomArea.centerInSceneCoord(this._t).multiply(this.scale).subtract(this.zoomArea.viewSize.divide(2));
  }

  get visibleArea(): Rect {
    return Rect.fromCenter(this._t.center, this.zoomArea.viewSize.divide(this._t.zoom));
  }

  // === Coordinates System Conversions ===
  toSceneCoord(p: Point, coord?: Coord): Point;
  toSceneCoord(p: Rect, coord?: Coord): Rect;
  toSceneCoord(p: Point | Rect, coord?: Coord): Point | Rect {
    // @ts-ignore: my understanding its that I should add if else if typeguards for Point and Rect
    // but both would call the same function. For readability and optimization I prefer to ignore this.
    return this.zoomArea.toSceneCoord(p, this._t, coord);
  }

  toViewCoord(p: Point, coord?: Coord): Point;
  toViewCoord(p: Rect, coord?: Coord): Rect;
  toViewCoord(p: Point | Rect, coord?: Coord): Point | Rect {
    // @ts-ignore: See comment above
    return this.zoomArea.toViewCoord(p, this._t, coord);
  }

  toRelativeCoord(p: Point, coord?: Coord): Point;
  toRelativeCoord(p: Rect, coord?: Coord): Rect;
  toRelativeCoord(p: Point | Rect, coord?: Coord): unknown {
    // @ts-ignore: See comment above
    return this.zoomArea.toRelativeCoord(p, this._t, coord);
  }

  view2scene(p: Point): Point {
    return p.subtract(this.zoomArea.viewSize.divide(2)).divide(this.scale).add(this.center);
  }

  scene2view(p: Point): Point {
    return p.subtract(this.center).multiply(this.scale).add(this.zoomArea.viewSize.divide(2));
  }

  client2scene(p: Point): Point {
    return p.subtract(this.zoomArea.clientRect.center).divide(this.scale).add(this.center);
  }

  client2view(py: number, px: number): Point;
  client2view(p: Point): Point;
  client2view(py: Point | number, px?: number): Point {
    const p = typeof py === "number" ? new Point(py, px!) : py;
    return p.subtract(this.zoomArea.clientRect.topLeft);
  }

  scene2client(p: Point): Point {
    return p.subtract(this.center).multiply(this.scale).add(this.zoomArea.clientRect.center);
  }
}

// =========================================================================
//          === ZOOM AREA CONTROLLER ===
// =========================================================================
interface ZoomAnimOpts {
  duration?: number;
  centerAnim?: Animation<Point>;
  zoomAnim?: Animation<number>;
  easing?: EasingFunction;
  cancelable?: boolean;
}

/**
 * Controller class to manage zoom and pan operations on a zoomable area.
 * It maintains the current transform state and provides methods to manipulate it.
 * It also supports animated transitions for zooming and panning.
 */
export class ZoomAreaController {
  protected _areaNode: HTMLElement | null = null; // Reference to the HTML element representing the zoom area
  protected _redrawHandle: number | null = null; // Handle for requestAnimationFrame to limit redraw frequency

  constructor(
    public state: ZoomAreaState,
    protected redrawZoomArea?: () => void,
  ) {}

  protected redraw(limitedFrequency: boolean = true): void {
    if (limitedFrequency) {
      // Redraw with limited frequency to avoid performance issues during rapid resize events
      if (!this._redrawHandle) {
        this._redrawHandle = requestAnimationFrame(() => {
          this._redrawHandle = null;
          this.redrawZoomArea?.();
        });
      }
    } else {
      this.redrawZoomArea?.();
    }
  }

  protected _setTransform(t: Transform, redraw_on_change: boolean = true, assume_different: boolean = false): boolean {
    if (!assume_different && isSameTransform(t, this.state.transform)) return false;
    this.state.transform = t;
    if (redraw_on_change) this.redraw(false);

    return true;
  }

  // === Area Properties ===
  protected _constrainCurrentTransform(redraw_on_change: boolean = true): boolean {
    const t = this.state.transform;
    const newT = this.state.zoomArea.constraintTransform(t);

    if (isSameTransform(t, newT)) return false;

    this.state.transform = newT;
    if (redraw_on_change) this.redraw(false);

    return true;
  }
  setAreaProperties(
    sceneDomain: Rect,
    maxScale: number,
    sceneOuterRect?: Rect,
    redraw_on_change: boolean = true,
  ): boolean {
    let changed = 0;
    changed += this.state.zoomArea.setSceneDomain(sceneDomain) ? 1 : 0;
    changed += this.state.zoomArea.setSceneOuterRect(sceneOuterRect || null) ? 1 : 0;
    changed += this.state.zoomArea.setMaxScale(maxScale) ? 1 : 0;

    if (changed <= 0) return false;

    // Ensure current transform is still valid
    return this._constrainCurrentTransform(redraw_on_change);
  }

  get areaNode(): HTMLElement | null {
    return this._areaNode;
  }

  setAreaNode(node: HTMLElement | null, redraw_on_change: boolean = true): void {
    this._areaNode = node;
    this.updateClientRect(redraw_on_change);
  }
  updateClientRect(redraw_on_change: boolean = true): void {
    if (!this._areaNode) return;
    return this.setClientRect(Rect.fromDOMRect(this._areaNode.getBoundingClientRect()), redraw_on_change);
  }
  setClientRect(clientRect: Rect, redraw_on_change: boolean = true): void {
    if (this.state.zoomArea.setClientRect(clientRect)) {
      this.state.setTransform(this.state.transform, true);
      if (redraw_on_change) this.redraw();
    }
  }

  // === Animations ===
  protected _animatorRun(
    lastTr: Transform,
    nextTr: Transform,
    zoomAnim: Animation<number>,
    relativeCenterAnim: Animation<Point> | null,
    opts?: ZoomAnimOpts,
    cb?: (t: { zoom: number; center: Point }) => void,
  ) {
    if (opts?.cancelable === false) this.state.animTarget = nextTr;
    else this.state.animTarget = lastTr;

    // RUN ANIMATION
    this.state.animator.run(
      {
        center: relativeCenterAnim,
        zoom: zoomAnim,
      },
      opts?.duration || 750,
      0,
      opts?.easing || "linear",
      false,
      cb || ((t: { zoom: number; center: Point }) => this._setTransform({ ...t, coord: "relative" })),
    );
  }

  protected _animateZoomPan(lastTr: Transform, nextTr: Transform, opts?: ZoomAnimOpts) {
    const area = this.state.zoomArea;

    // BIND PAN ANIMATION if provided
    const c0 = area.centerInRelativeCoord(lastTr);
    const c1 = area.centerInRelativeCoord(nextTr);
    let panAnim: Animation<Point> | null | undefined = opts?.centerAnim;
    if (panAnim) panAnim.setFirstLastValues(c0, c1);

    let zoomAnim = opts?.zoomAnim;
    if (zoomAnim) {
      // BIND ZOOM ANIMATION if provided
      zoomAnim.setFirstLastValues(lastTr.zoom, nextTr.zoom);
    } else {
      // otherwise SETUP ZOOM ANIMATION depending on the zoom direction and distance
      if (lastTr.zoom < nextTr.zoom) {
        // - if zoom out: simple cubicOut easing
        zoomAnim = Animation.simple(lastTr.zoom, nextTr.zoom, "cubicOut");
      } else {
        const panDiff = area.centerInSceneCoord(lastTr).subtract(area.centerInSceneCoord(nextTr)).norm();
        if (panDiff < area.viewSize.max() / 2) {
          // - if zoom in inside view: simple cubicInOut easing
          zoomAnim = Animation.simple(lastTr.zoom, nextTr.zoom, "cubicInOut");
        } else {
          // - otherwise, zoom out a bit first, then zoom in while panning
          const zoomOut = Math.sqrt(lastTr.zoom + 1) - 1;
          zoomAnim = new Animation([
            { t: 0, v: lastTr.zoom, easing: "cubicOut" },
            { t: 0.3, v: zoomOut, easing: "cubicInOut" },
            { t: 1, v: nextTr.zoom },
          ]);
          if (!panAnim) {
            panAnim = new Animation([
              { t: 0, v: c0, easing: "cubicInOut" },
              { t: 0.9, v: c1 },
            ]);
          }
        }
      }
    }

    // SETUP PAN ANIMATION if not provided
    if (!panAnim) panAnim = Animation.simple(c0, c1);

    // RUN ANIMATION
    const animTick = (t: { zoom: number; center: Point }) => {
      this._setTransform({ ...t, coord: "relative" }, true, true);
    };

    this._animatorRun(lastTr, nextTr, zoomAnim, panAnim, opts, animTick);
  }

  /**
   * Animate a simple zoom movement
   * @param lastTr The last transform state.
   * @param nextTr The next transform state.
   * @param zoomCenter The center point of the zoom. /!\ Must be in scene coordinates!
   * @param opts Animation options.
   */
  protected _animateZoom(lastTr: Transform, nextTr: Transform, zoomCenter?: Point, opts?: ZoomAnimOpts) {
    const area = this.state.zoomArea;

    let zoomAnim = opts?.zoomAnim;
    if (zoomAnim) zoomAnim.setFirstLastValues(lastTr.zoom, nextTr.zoom);
    else zoomAnim = Animation.simple(lastTr.zoom, nextTr.zoom);

    // RUN ANIMATION
    const animTick = (t: { zoom: number; center: Point }) =>
      this._setTransform(area.applyZoom(lastTr, t.zoom - lastTr.zoom, zoomCenter, "scene"), true, true);
    this._animatorRun(lastTr, nextTr, zoomAnim, null, opts, animTick);
  }

  // === Actions ===
  _actionInit(): [Transform, Transform, ZoomAreaCalculator] {
    const currentTr = this.state.transform;
    let tr = currentTr;
    // Flush ongoing animations
    if (this.state.animator.running) {
      if (this.state.animTarget) tr = this.state.animTarget;
      this.state.animator.stop();
    }
    return [currentTr, tr, this.state.zoomArea];
  }

  setTransform(t: Transform, anim?: ZoomAnimOpts) {
    const [prevTr] = this._actionInit();
    t = this.state.zoomArea.constraintTransform(t);

    if (anim) this._animateZoomPan(prevTr, t, anim);
    else this._setTransform(t);
  }

  setCenter(center: Point, coord: Coord = "scene", anim?: ZoomAnimOpts) {
    const [prevTr, tr, area] = this._actionInit();
    // Convert center to scene coordinates
    if (coord === "relative") center = center.multiply(area.sceneDomain.size);
    else if (coord === "view") center = center.divide(this.state.scale).add(area.centerInSceneCoord(tr));

    const nextTr = area.constraintCenter(
      {
        zoom: tr.zoom,
        center: center,
      },
      area.centerInSceneCoord(tr),
    );
    if (anim) this._animateZoomPan(prevTr, nextTr, anim);
    else this._setTransform(nextTr);
  }

  setCenterX(centerX: number, coord: Coord = "scene", anim?: ZoomAnimOpts) {
    centerX = this.state.toSceneCoord(new Point(0, centerX), coord).x;
    this.setCenter(new Point(this.state.center.y, centerX), "scene", anim);
  }

  setCenterY(centerY: number, coord: Coord = "scene", anim?: ZoomAnimOpts) {
    centerY = this.state.toSceneCoord(new Point(centerY, 0), coord).y;
    this.setCenter(new Point(centerY, this.state.center.x), "scene", anim);
  }

  setZoom(zoom: number, anim?: ZoomAnimOpts) {
    const [prevTr, _, area] = this._actionInit();
    const nextTr = area.constraintTransform({
      zoom: zoom,
      center: this.state.center,
    });

    if (anim) this._animateZoom(prevTr, nextTr, this.state.center, anim);
    else this._setTransform(nextTr);
  }

  zoomBy(dZoom: number, zoomCenter?: Point, coord?: Coord, anim?: ZoomAnimOpts) {
    const [prevTr, tr, area] = this._actionInit();
    const nextTr = area.applyZoom(tr, dZoom, zoomCenter, coord);

    if (anim) this._animateZoom(prevTr, nextTr, zoomCenter, anim);
    else this._setTransform(nextTr);
  }

  panBy(dCenter: Point, coord: Coord = "view", anim?: ZoomAnimOpts) {
    const [prevTr, tr, area] = this._actionInit();
    // Convert dCenter to scene coordinates
    if (coord === "relative") dCenter = dCenter.multiply(area.sceneDomain.size);
    else if (coord === "view") dCenter = dCenter.divide(this.state.scale);
    const center = area.centerInSceneCoord(tr);
    const nextTr = area.constraintCenter({ zoom: tr.zoom, center: center.add(dCenter), coord: "scene" }, center);
    if (anim) this._animateZoomPan(prevTr, nextTr, anim);
    else this._setTransform(nextTr);
  }

  panHorizontallyBy(delta: number, coord: Coord = "view", anim?: ZoomAnimOpts) {
    this.panBy(new Point(0, delta), coord, anim);
  }

  panVerticallyBy(delta: number, coord: Coord = "view", anim?: ZoomAnimOpts) {
    this.panBy(new Point(delta, 0), coord, anim);
  }

  setVisibleRect(visibleRect: Rect, coord: Coord = "scene", anim?: ZoomAnimOpts) {
    if (visibleRect.isEmpty()) return;
    const [prevTr] = this._actionInit();

    visibleRect = this.state.toSceneCoord(visibleRect, coord);
    const nextTr = this.state.zoomArea.visibleArea2Transform(visibleRect, "scene");

    if (anim) this._animateZoomPan(prevTr, nextTr, anim);
    else this._setTransform(nextTr);
  }
}
