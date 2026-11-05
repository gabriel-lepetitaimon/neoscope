import useResizeObserver from "@react-hook/resize-observer";
import React, { RefObject } from "react";
import { Point } from "./geometry";

export default function useSize(target: RefObject<HTMLElement | null>): Point {
  const [size, setSize] = React.useState(new Point(0, 0));

  React.useLayoutEffect(() => {
    const width = target.current?.getBoundingClientRect().width;
    const height = target.current?.getBoundingClientRect().height;
    setSize(new Point(height, width));
  }, [target]);

  useResizeObserver(target.current, (entry) => {
    const { width, height } = entry.contentRect;
    setSize(new Point(height, width));
  });
  return size;
}
