import * as React from "react";
import { createRoot } from "react-dom/client";
import { Render } from "@anywidget/types";
import { NeoscopeStore, NeoscopeStoreFactory, serializeNode, applyUpdates, computeStateDiff } from "./neoscopeStore";

interface NeoscopeAnyWidgetModel {
  _frontend_data: Record<string, any>;
}

export function createAnywidgetRenderer<Model extends Record<string, any>>(
  render: (store: NeoscopeStore<Model, any>) => React.ReactNode,
  createStore: NeoscopeStoreFactory<Model, any>,
  debounceMs: number = 50,
) {
  const renderHook: Render<NeoscopeAnyWidgetModel> = ({ model, el }) => {
    function sendEvent(eventName: string, args: any[]) {
      model.send({ event: { type: eventName, args } });
    }

    // Create the store and the React root for this widget instance
    const store = createStore((eventName, eventArgs) => sendEvent(eventName, eventArgs));
    const root = createRoot(el);
    el.classList.add("neoscope-widget-root");

    // Listen to changes from the React store and update the Python model accordingly
    let currentVersion: number = -1;
    let lastSyncedState = store.getState();

    // Debounce mechanism to avoid sending too many updates in a short time
    let sendTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingPatch: Record<string, any> = {};

    function sendPendingPatch() {
      if (Object.keys(pendingPatch).length === 0) return;
      currentVersion += 1;
      model.send({ patch: pendingPatch, __version__: currentVersion });
      pendingPatch = {};
    }

    function updateLocalSnapshot(state: any) {
      // Update the local snapshot of the frontend state so it may be saved with the notebook
      // but don't call save_changes() to avoid triggering a full sync with Python.
      const fullSnapshot = serializeNode({ __kind: "submodel", schema: store.schema }, state);
      fullSnapshot.__version__ = currentVersion;
      model.set("_frontend_data", fullSnapshot);
    }

    // 1. Initialize the store with the traitlet's _frontend_data
    const initialData = model.get("_frontend_data");
    if (initialData) {
      currentVersion = initialData.__version__ ?? 0;
      const { nextState, hasChanges } = applyUpdates(store.schema, store.getState(), initialData);
      if (hasChanges) {
        lastSyncedState = nextState;
        store.setState(nextState);
      }
    }

    // 2. Frontend (Zustand) -> Python (Partial udpate)
    const unsubscribeStore = store.subscribe((state) => {
      const diff = computeStateDiff(store.schema, lastSyncedState, state);
      lastSyncedState = state;

      if (Object.keys(diff).length === 0) return;

      // Accumule les changements dans le patch en attente
      Object.assign(pendingPatch, diff);
      updateLocalSnapshot(state);

      if (!sendTimeout) {
        sendPendingPatch();
        sendTimeout = setTimeout(() => {
          sendPendingPatch();
          sendTimeout = null;
        }, debounceMs);
      }
    });

    /// 3. Python -> Frontend (Réception des messages custom)
    function onCustomMessage(msg: any) {
      if (!msg || typeof msg !== "object" || !msg.patch) return;

      const incomingVersion = msg.__version__ ?? 0;
      if (incomingVersion <= currentVersion) return;
      currentVersion = incomingVersion;

      const { nextState, hasChanges } = applyUpdates(store.schema, store.getState(), msg.patch);
      if (hasChanges) {
        lastSyncedState = nextState;
        store.setState(nextState);
        updateLocalSnapshot(nextState);
      }
    }

    model.on("msg:custom", onCustomMessage);
    root.render(render(store)); // Render the React component with the appropriate store

    return () => {
      if (sendTimeout) {
        clearTimeout(sendTimeout);
        sendPendingPatch();
      }
      unsubscribeStore();
      model.off("change:_frontend_data", onCustomMessage);
      root.unmount();
    };
  };
  return { render: renderHook };
}
