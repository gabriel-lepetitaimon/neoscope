import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/base";

import "./css/HelloButton.css";

const Model = {
  value: 0,
};

interface Events {
  onClick: (value: number) => void;
}

const [createHelloStore, useHelloStore] = createNeoscopeStore<Events>()(Model, {
  actions: (set) => ({
    inc() {
      set((state) => ({ value: state.value + 1 }));
    },
  }),
});

const HelloButton = () => {
  const { value, inc, onClick } = useHelloStore();
  function handleClick() {
    inc();
    onClick(value + 1);
  }

  return (
    <div className="neoscope">
      <button onClick={handleClick}>count is {value}</button>
    </div>
  );
};

export default createNeoscopeRenderer(() => <HelloButton />, createHelloStore);
