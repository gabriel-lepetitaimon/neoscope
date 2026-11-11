import { Point, Rect } from "../utils/geometry";
import { field, FieldDef } from "./neoscopeStore";

export function fieldRect(defaultValue: Rect = new Rect(new Point(0, 0))): FieldDef<Rect> {
  return field<Rect>(defaultValue, {
    serialize: (rect) => rect.toTuple(),
    deserialize: (tuple) => Rect.fromTuple(tuple),
  });
}
