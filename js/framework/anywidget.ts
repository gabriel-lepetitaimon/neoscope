import * as React from "react";
import { createRender, useModelState } from "@anywidget/react";
import "./widget.css";

interface ImageViewerModel {
  image: string;
}

const render = createRender(() => {
  const [model] = useModelState<ImageViewerModel>("_frontend_data");
  return (
    <div className="neoscope">
      <img src={model.image} />
    </div>
  );
});

export default { render };
