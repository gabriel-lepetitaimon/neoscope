from __future__ import annotations

import weakref
from typing import Any

from .. import __asset_dir__
from ..utils.safe_import import anywidget, traitlets
from .base_model import _DELETED, BaseModel, is_deleted
from .base_widget_model import _WIDGET_KEY, BaseWidgetModel

_FRONTEND_DATA_KEY = "_frontend_data"


def render_anywidget[MODEL: BaseWidgetModel](widget: MODEL) -> NeoscopeAnyWidget[MODEL]:
    return NeoscopeAnyWidget[MODEL].specialize(type(widget))(model=widget)


class NeoscopeAnyWidget[MODEL: BaseWidgetModel](anywidget.AnyWidget):
    """Base class for all widgets in the neoscope package.
    This class provides a common interface for all widgets.
    """

    _frontend_data = traitlets.Dict().tag(sync=True)
    """The _frontend_data traitlet is used to send the initial model data to the frontend and provide a way to save the model state in the frontend. All subsequent changes to the model are sent as patch messages."""

    def __init__(self, model: MODEL):
        super().__init__()
        self._model = weakref.ref(model)
        self._version = 0
        setattr(self, _FRONTEND_DATA_KEY, model.dump_flat_json() | {"__version__": self._version})
        self.on_msg(self.on_msg_received)
        model.on_change(self.on_python_model_change, silenceable=True)

    def on_python_model_change(self, field: str, value: Any):
        model = self._model()
        if model is None or model._silence_change_notifications:
            return

        # Send a patch message to the frontend with the updated field and value
        self._version += 1
        serialized_patch = _DELETED if is_deleted(value) else model.serialize_field(field)
        self.send({"patch": {field: serialized_patch}, "__version__": self._version})

    def on_msg_received(self, widget, msg, buffers):
        """Gère les messages custom reçus du frontend (événements et patchs d'état)."""
        model = self._model()
        self._last_received_msg = msg
        if model is None:
            return

        # 1. UI Event messages  (ex: click)
        if (event_msg := msg.get("event")) is not None and isinstance(event_msg, dict):
            event_type = event_msg.get("type")
            if isinstance(event_type, str):
                model._dispatch_event(
                    event_type,
                    args=event_msg.get("args", []),
                    kwargs=event_msg.get("kwargs", {}),
                )

        # 2. Frontend state patch messages (ex: input value change)
        if (patch := msg.get("patch")) is not None and isinstance(patch, dict):
            incoming_version = msg.get("__version__", self._version + 1)
            if incoming_version < self._version:
                return
            self._version = incoming_version

            for key, new_value in patch.items():
                model.on_frontend_change(key, new_value)

    @classmethod
    def specialize(cls, model_cls: type[MODEL]) -> type[NeoscopeAnyWidget[MODEL]]:
        """Create a specialized AnyWidget class for the given model type."""
        if not issubclass(model_cls, BaseWidgetModel):
            raise TypeError(f"model must be a subclass of BaseWidgetModel, got {model_cls}")

        # === Check for existing specialized class ===
        if hasattr(model_cls, "_anywidget_cls"):
            return model_cls._anywidget_cls  # type: ignore

        # === Otherwise create the specialized class ===
        widget_name = getattr(model_cls, _WIDGET_KEY, None)
        if not isinstance(widget_name, str):
            widget_name = getattr(widget_name, "default", None)

        specialized_cls = type(
            f"{widget_name}_AnyWidget",
            (NeoscopeAnyWidget,),
            {
                "_esm": __asset_dir__ / f"{widget_name}-anywidget.js",
                "_css": __asset_dir__ / f"{widget_name}-anywidget.css",
            },
        )

        model_cls._anywidget_cls = specialized_cls  # type: ignore
        return specialized_cls
