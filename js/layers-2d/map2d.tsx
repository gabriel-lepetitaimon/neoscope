import * as React from "react";
import { field, InferModel } from "../framework-glue/base";
import { ImageStr, parseImageString } from "../utils/image";
import { BaseLayer2D, BaseLayer2DSchema } from "./base-layer";

function imageField() {
  return field<ImageStr>({ width: 0, height: 0, data: "" }, { deserialize: (bytes) => parseImageString(bytes) });
}

export const ColorMapSchema = {
  ...BaseLayer2DSchema,
  image: imageField(),
};

export function ColorMapLayer({ model }: { model: InferModel<BaseLayer2D> }) {
  /// TODO:  replace with a proper type assertion
  const model_ = model as InferModel<typeof ColorMapSchema>;
  return <image href={model_.image.data} width={model_.image.height} height={model_.image.width} />;
}
