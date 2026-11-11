import React from "react";
import { field, InferModel, UseModelSchema } from "../framework-glue/base";
import { Property } from "csstype";

// ==========================================
//   --- BASE LAYER 2D ---
// ==========================================
export const BaseLayer2DSchema = {
  layer_type: field<string>(""),
  blend_mode: field<Property.MixBlendMode>("normal"),
  opacity: field(1.0),
  transform: fieldTransformMatrix(),
  transform_origin: field<[number, number, "absolute" | "relative"]>([0, 0, "absolute"]),
  visibility: field(true),
  z_index: field(0),
};
export type BaseLayer2D = typeof BaseLayer2DSchema;

import { ColorMapLayer } from "./map2d";

export function renderLayer(model: InferModel<BaseLayer2D>) {
  const renderLayer = {
    ColorMap: () => <ColorMapLayer model={model} />,
  }[model.layer_type];
  if (!renderLayer) throw new Error(`Unknown layer type: ${model.layer_type}`);

  return (
    <g
      transform={model.transform}
      style={{ mixBlendMode: model.blend_mode }}
      opacity={model.opacity}
      visibility={model.visibility ? "visible" : "hidden"}
    >
      {renderLayer()}
    </g>
  );
}

// ==========================================
//   --- LAYERS RENDERER ---
// ==========================================
export function LayersRenderer({ layers }: { layers: Record<string, InferModel<BaseLayer2D>> }) {
  // Sort layers by z_index
  const sortedNames = Object.keys(layers).sort((a, b) => layers[a].z_index - layers[b].z_index);

  return (
    <>
      {sortedNames.map((name) => (
        <React.Fragment key={name}>{renderLayer(layers[name])}</React.Fragment>
      ))}
    </>
  );
}

// ==========================================
//   --- UTILITIES ---
// ==========================================
export function fieldTransformMatrix() {
  function to_string(matrix: [[number, number, number], [number, number, number]]) {
    return `matrix(${matrix.flat().join(", ")})`;
  }
  return field<string>(
    to_string([
      [1, 0, 0],
      [0, 1, 0],
    ]),
    {
      deserialize: (matrix) => to_string(matrix),
      serialize: (str) => {
        const [a, b, c, d, e, f] = str
          .match(/matrix\(([^)]+)\)/)?.[1]
          .split(",")
          .map(Number) || [1, 0, 0, 1, 0, 0];
        return [
          [a, b, c],
          [d, e, f],
        ];
      },
    },
  );
}
