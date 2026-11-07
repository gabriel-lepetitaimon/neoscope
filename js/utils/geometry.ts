/*********************************************************
 *     === Point ===
 *********************************************************/
export class Point {
  constructor(
    public y = 0,
    public x = 0,
  ) {}

  static ORIGIN = Object.freeze(new Point(0, 0));

  add(fy: number, fx: number): Point;
  add(f: number | Point): Point;
  add(fy: number | Point, fx?: number): Point {
    if (fy instanceof Point) return new Point(this.y + fy.y, this.x + fy.x);
    if (fx !== undefined) return new Point(this.y + fy, this.x + fx);
    return new Point(this.y + fy, this.x + fy);
  }

  subtract(fy: number, fx: number): Point;
  subtract(f: number | Point): Point;
  subtract(fy: number | Point, fx?: number): Point {
    if (fy instanceof Point) return new Point(this.y - fy.y, this.x - fy.x);
    if (fx !== undefined) return new Point(this.y - fy, this.x - fx);
    return new Point(this.y - fy, this.x - fy);
  }

  divide(fy: number, fx: number): Point;
  divide(f: number | Point): Point;
  divide(fy: number | Point, fx?: number): Point {
    if (fy instanceof Point) return new Point(this.y / fy.y, this.x / fy.x);
    if (fx !== undefined) return new Point(this.y / fy, this.x / fx);
    return new Point(this.y / fy, this.x / fy);
  }

  multiply(fy: number, fx: number): Point;
  multiply(f: number | Point): Point;
  multiply(fy: number | Point, fx?: number): Point {
    if (fy instanceof Point) return new Point(this.y * fy.y, this.x * fy.x);
    if (fx !== undefined) return new Point(this.y * fy, this.x * fx);
    return new Point(this.y * fy, this.x * fy);
  }

  half(): Point {
    return new Point(this.y * 0.5, this.x * 0.5);
  }

  interpolate(to: Point, weight: number): Point {
    return new Point(this.y * (1 - weight) + to.y * weight, this.x * (1 - weight) + to.x * weight);
  }

  clip(r: Rect | Point): Point {
    if (r instanceof Point) {
      return new Point(Math.min(r.y, this.y), Math.min(r.x, this.x));
    } else {
      return new Point(
        Math.min(r.bottomRight.y, Math.max(r.topLeft.y, this.y)),
        Math.min(r.bottomRight.x, Math.max(r.topLeft.x, this.x)),
      );
    }
  }

  clip_norm(r: number): Point {
    const f = r / Math.max(this.norm(), r);
    return f < 1 ? this.multiply(f) : this;
  }

  in(r: Rect | Point, strict = false): boolean {
    if (r instanceof Point) {
      return strict ? this.y < r.y && this.x < r.x : this.y <= r.y && this.x <= r.x;
    }
    if (strict) {
      return r.topLeft.x < this.x && this.x < r.bottomRight.x && r.topLeft.y < this.y && this.y < r.bottomRight.y;
    } else {
      return r.topLeft.x <= this.x && this.x <= r.bottomRight.x && r.topLeft.y <= this.y && this.y <= r.bottomRight.y;
    }
  }

  round(): Point {
    return new Point(Math.round(this.y), Math.round(this.x));
  }

  floor(): Point {
    return new Point(Math.floor(this.y), Math.floor(this.x));
  }

  ceil(): Point {
    return new Point(Math.ceil(this.y), Math.ceil(this.x));
  }

  neg(): Point {
    return new Point(-this.y, -this.x);
  }

  inv(): Point {
    return new Point(1 / this.y, 1 / this.x);
  }

  abs(): Point {
    return new Point(Math.abs(this.y), Math.abs(this.x));
  }

  min(): number {
    return Math.min(this.x, this.y);
  }

  max(): number {
    return Math.max(this.x, this.y);
  }

  norm(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  hasZero() {
    return this.x === 0 || this.y === 0;
  }

  isZero() {
    return this.x === 0 && this.y === 0;
  }

  equals(p: Point): boolean {
    return this.x === p.x && this.y === p.y;
  }
}

export const ORIGIN = Point.ORIGIN;

/*********************************************************
 *     === RECT ===
 *********************************************************/
export class Rect {
  topLeft: Point;
  bottomRight: Point;

  constructor(topLeft: Point, bottomRight: Point);
  constructor(bottomRight: Point);
  constructor(p1: Point, p2?: Point) {
    if (p2 !== undefined) {
      this.topLeft = p1 as Point;
      this.bottomRight = p2 as Point;
    } else {
      this.topLeft = ORIGIN;
      this.bottomRight = p1 as Point;
    }
  }

  static EMPTY = Object.freeze(new Rect(ORIGIN, ORIGIN));

  static unitary(): Rect {
    return new Rect(new Point(1, 1));
  }

  static fromYX(y1: number, y2: number, x1: number, x2: number): Rect {
    return new Rect(new Point(Math.min(y1, y2), Math.min(x1, x2)), new Point(Math.max(y1, y2), Math.max(x1, x2)));
  }

  static fromXY(x1: number, x2: number, y1: number, y2: number): Rect {
    return new Rect(new Point(Math.min(y1, y2), Math.min(x1, x2)), new Point(Math.max(y1, y2), Math.max(x1, x2)));
  }

  static fromTuple(hwyx: number[]): Rect {
    let [h, w, y, x] = hwyx;
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }
    return new Rect(new Point(y, x), new Point(y + h, x + w));
  }

  static fromCenter(center: Point, size: Point): Rect {
    const halfSize = size.divide(2).abs();
    return new Rect(center.subtract(halfSize), center.add(halfSize));
  }

  static fromDOMRect(r: DOMRect): Rect {
    const rect = new Rect(new Point(r.top, r.left), new Point(r.bottom, r.right));
    return rect;
  }

  get top(): number {
    return this.topLeft.y;
  }

  get left(): number {
    return this.topLeft.x;
  }

  get right(): number {
    return this.bottomRight.x;
  }

  get bottom(): number {
    return this.bottomRight.y;
  }

  get width(): number {
    return this.bottomRight.x - this.topLeft.x;
  }

  get height(): number {
    return this.bottomRight.y - this.topLeft.y;
  }

  get size(): Point {
    return this.bottomRight.subtract(this.topLeft);
  }

  get center(): Point {
    return new Point((this.bottomRight.y + this.topLeft.y) / 2, (this.bottomRight.x + this.topLeft.x) / 2);
  }

  checkPositiveSize(): boolean {
    return this.width >= 0 && this.height >= 0;
  }

  isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  translate(f: number | Point): Rect {
    return new Rect(this.topLeft.add(f), this.bottomRight.add(f));
  }

  scale(s: number | Point): Rect {
    return new Rect(this.topLeft.multiply(s), this.bottomRight.multiply(s));
  }

  in(r: Rect, strict = false): boolean {
    return this.topLeft.in(r, strict) && this.bottomRight.in(r, strict);
  }

  intersection(r: Rect): Rect {
    return new Rect(this.topLeft.clip(r), this.bottomRight.clip(r));
  }

  equals(r: Rect): boolean {
    return (
      this.topLeft.x === r.topLeft.x &&
      this.topLeft.y === r.topLeft.y &&
      this.bottomRight.x === r.bottomRight.x &&
      this.bottomRight.y === r.bottomRight.y
    );
  }

  union(r: Rect | Point): Rect {
    if (r instanceof Point) {
      return this.union(Rect.fromXY(this.center.x, r.x, this.center.y, r.y));
    } else {
      return Rect.fromXY(
        Math.min(this.left, r.left),
        Math.max(this.right, r.right),
        Math.min(this.top, r.top),
        Math.max(this.bottom, r.bottom),
      );
    }
  }

  pad(padding: Rect | Point | number, outward = false): Rect {
    let resultingRect: Rect;
    if (padding instanceof Rect) {
      if (outward) {
        padding = new Rect(ORIGIN.subtract(padding.topLeft), ORIGIN.subtract(padding.bottomRight));
      }
      resultingRect = new Rect(this.topLeft.add(padding.topLeft), this.bottomRight.add(padding.bottomRight));
    } else {
      if (outward) {
        padding = ORIGIN.subtract(padding);
      }
      resultingRect = new Rect(this.topLeft.add(padding), this.bottomRight.subtract(padding));
    }
    if (resultingRect.checkPositiveSize()) {
      return resultingRect;
    } else {
      return Rect.fromCenter(resultingRect.center, ORIGIN);
    }
  }

  interpolate(to: Rect, weight: number): Rect {
    return new Rect(this.topLeft.interpolate(to.topLeft, weight), this.bottomRight.interpolate(to.bottomRight, weight));
  }

  relativeTo(r: Rect): Rect {
    return new Rect(
      this.topLeft.subtract(r.topLeft).divide(r.size),
      this.bottomRight.subtract(r.topLeft).divide(r.size),
    );
  }
}

/*********************************************************
 *     === TRANSFORM ===
 *********************************************************/
export interface Transform {
  center: Point;
  coord?: "scene" | "relative";
  zoom: number;
}

export function isSameTransform(t1: Transform, t2: Transform): boolean {
  return t1.center.equals(t2.center) && t1.zoom === t2.zoom;
}
