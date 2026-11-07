import * as React from "react";
import "./widget.css";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/neoscope";

const _defaults = {
  value: 0,
};
type HelloButtonModel = typeof _defaults;

interface HelloButtonActions {
  inc: () => void;
}

const store = createNeoscopeStore<HelloButtonModel, HelloButtonActions>(_defaults, (set) => ({
  inc() {
    set((state) => {
      return { value: state.value + 1 };
    });
  },
}));

const HelloButton = () => {
  const { value, inc } = store();
  return (
    <div className="neoscope">
      <button onClick={inc}>count is {value}</button>
    </div>
  );
};

export default createNeoscopeRenderer(() => <HelloButton />, store);
