import * as React from "react";
import { createNeoscopeRenderer, createNeoscopeStore, field } from "./framework-glue/base";

import "./css/HelloButton.css";

/*************************************************************************
 *  === ImageViewer MODEL ===
 *************************************************************************/
const Model = {
  value: field(0),
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

/*************************************************************************
 *  === ImageViewer COMPONENT ===
 *************************************************************************/
const HelloButton = () => {
  const { value, inc, click } = useHelloStore();
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
