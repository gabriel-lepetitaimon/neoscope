import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore } from "./framework-glue/base";

import "./css/HelloButton.css";

const Model = {
  value: 0,
};

interface Events {
  click: (value: number) => void;
}

const [createHelloStore, useHelloStore] = createNeoscopeStore<Events>()(Model, {
  actions: (set) => ({
    inc() {
      set((state) => ({ value: state.value + 1 }));
    },
  }),
});

const HelloButton = () => {
  const { value, inc, click } = useHelloStore();
  console.log("HelloButton render: value =", value);
  function handleClick() {
    inc();
    click(value + 1);
  }

  return (
    <div className="neoscope">
      <button onClick={handleClick}>count is {value}</button>
    </div>
  );
};

export default createNeoscopeRenderer(() => <HelloButton />, createHelloStore);
