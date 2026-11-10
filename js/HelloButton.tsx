import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/base";

import "./css/HelloButton.css";

const _defaults = {
  value: 0,
};

const [createHelloStore, useHelloStore] = createNeoscopeStore(_defaults, {
  actions: (set) => ({
    inc() {
      set((state) => ({ value: state.value + 1 }));
    },
  }),
});

const HelloButton = () => {
  const { value, inc } = useHelloStore();
  return (
    <div className="neoscope">
      <button onClick={inc}>count is {value}</button>
    </div>
  );
};

export default createNeoscopeRenderer(() => <HelloButton />, createHelloStore);
