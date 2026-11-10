from __future__ import annotations

import functools
import weakref
from collections.abc import Callable, Sequence
from typing import Any, Generic, ParamSpec, Self

import anywidget
import numpy as np
import pydantic
import streamlit as st
import traitlets

from neoscope.utils import ContextFlag

from . import __asset_dir__

_WIDGET_KEY = "__WIDGET__"


################################################
# == Event handler (typescript -> python) ===

P = ParamSpec("P")


class EventSubscription:
    """Handle returned when subscribing to an event, allowing to unsubscribe."""

    def __init__(self, unsubscribe_fn: Callable[[], None]):
        self._unsubscribe_fn = unsubscribe_fn
        self._active = True

    def unsubscribe(self) -> None:
        """Unsubscribe the callback from the event."""
        if self._active:
            self._unsubscribe_fn()
            self._active = False

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: Any) -> None:
        self.unsubscribe()


class BoundEventSubscriber[**P]:
    """Object bound to a model intance, allowing to subscribe to an event with a callback."""

    def __init__(self, model: BaseWidgetModel, event_name: str, doc: str | None = None):
        self._model = model
        self._event_name = event_name
        self.__doc__ = doc

    def __call__(self, callback: Callable[P, Any]) -> EventSubscription:
        """Register a callback for the event and return an EventSubscription to manage it."""
        return self._model._add_event_listener(self._event_name, callback)


class EventSubscribeDescriptor[**P]:
    """Descriptor exposing the subscription method with its signature and docstring."""

    def __init__(self, event_name: str, func: Callable[..., Any]):
        self.event_name = event_name
        self.func = func
        functools.update_wrapper(self, func)

    def __get__(self, instance: BaseWidgetModel | None, owner: type[BaseWidgetModel]) -> Any:
        if instance is None:
            return self
        return BoundEventSubscriber[P](instance, self.event_name, self.__doc__)


def event(name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator for marking an internal method as the default handler for an event."""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        func._callback_on_event = name
        return func

    return decorator


def event_subscribe(
    name: str,
) -> Callable[[Callable[P, Any]], EventSubscribeDescriptor[P]]:
    """Decorator for exposing a typed and documented subscription method on the model.

    The signature of the decorated method defines the expected type for the callback:
    ```python
    @event_subscribe("click")
    def on_click(value: int) -> None:
        '''Called when the button is clicked.'''
        ...
    ```
    """

    def decorator(func: Callable[P, Any]) -> EventSubscribeDescriptor[P]:
        return EventSubscribeDescriptor[P](name, func)

    return decorator


class BaseModel(pydantic.BaseModel):
    """A base model that watches for changes in its fields and triggers a callback."""

    model_config = pydantic.ConfigDict(
        validate_assignment=True,
        ignored_types=(EventSubscribeDescriptor,),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._watchers: list[tuple[str, bool, Any]] = []
        self._silence_change_notifications = ContextFlag()
        for field_name in type(self).model_fields:
            value = getattr(self, field_name)
            if isinstance(value, BaseModel):
                value.on_change(self._notify_watchers, prefix=f"{field_name}.", silenceable=False)

    def on_change(self, callback: Callable[[str, Any], None], prefix: str = "", silenceable: bool = False) -> None:
        """Add a watcher callback that will be called when the model changes.
        The callback will be called with the name of the field that changed and its new value.
        """
        self._watchers.append((prefix, silenceable, callback))

    def _notify_watchers(self, field: str, value: Any) -> None:
        """Notify all watchers of a change in the model."""
        for watcher_prefix, silenceable, watcher in self._watchers:
            # watcher = watcher_ref()
            if watcher is not None and (not silenceable or not self._silence_change_notifications):
                watcher(f"{watcher_prefix}{field}", value)

    def __setattr__(self, name: str, value: Any) -> None:
        if name in type(self).model_fields:
            old_value = getattr(self, name, None)
            super().__setattr__(name, value)
            if old_value is not value:
                self._notify_watchers(field=name, value=value)
        else:
            super().__setattr__(name, value)


class BaseWidgetModel(BaseModel):
    def __init_subclass__(cls, widget: str, **kwargs):
        super().__init_subclass__(**kwargs)
        if not hasattr(cls, _WIDGET_KEY):
            setattr(cls, _WIDGET_KEY, widget)
        # Scan for event callbacks members and register them
        events_callback = {}
        for attr_value in cls.__dict__.values():
            if callable(attr_value) and hasattr(attr_value, "_callback_on_event"):
                event_name = attr_value._callback_on_event
                # Register the event callback
                events_callback[event_name] = attr_value
        cls._events_callback = events_callback

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._anywidget: NeoscopeAnyWidget[Self] | None = None
        self._event_listeners: dict[str, list[Callable[..., Any]]] = {}  # Instance specific event listeners

    @classmethod
    def widget_name(cls) -> str:
        """Get the widget name associated with the model."""
        if not issubclass(cls, BaseWidgetModel):
            raise TypeError(f"cls must be a subclass of BaseWidgetModel, got {cls}")
        widget_name = getattr(cls, _WIDGET_KEY, None)
        if not isinstance(widget_name, str):
            widget_name = getattr(widget_name, "default", None)
        if widget_name is None:
            raise ValueError(f"Widget name not found for model {cls.__name__}")
        return widget_name

    def dump_flat_json(self, *, sep: str = ".") -> dict[str, Any]:
        """Flatten the model to a dictionary, including nested models."""

        json_data = self.model_dump(mode="json")

        def flatten_recursive(model: Any, json_data: Any, parent_key: str = "") -> dict[str, Any]:
            flatten_json = {}
            model_type = type(model)
            if issubclass(model_type, BaseWidgetModel):
                assert isinstance(json_data, dict), "Expected json_data to be a dict for BaseWidgetModel"
                for field_name in model_type.model_fields:
                    new_key = f"{parent_key}{sep}{field_name}" if parent_key else field_name
                    field_value = getattr(model, field_name)
                    json_value = json_data.get(field_name)
                    if isinstance(field_value, BaseWidgetModel):
                        flatten_json.update(flatten_recursive(field_value, json_value, new_key))
                    else:
                        flatten_json[new_key] = json_value
            else:
                flatten_json[parent_key] = json_data
            return flatten_json

        return flatten_recursive(self, json_data)

    ### STATE SYNCHRONIZATION ###
    def on_frontend_change(self, keys: str | Sequence[str], value) -> bool:
        """Update the widget when the model changes."""
        if self._silence_change_notifications:
            return False
        d = self
        if isinstance(keys, str):
            keys = keys.split(".")
        for k in keys[:-1]:
            d = getattr(d, k)
        e = getattr(d, keys[-1]) == value
        if (isinstance(e, bool) and e) or (isinstance(e, np.ndarray) and np.all(e)):
            return False
        with self._silence_change_notifications:
            try:
                setattr(d, keys[-1], value)
            except Exception as e:
                return False
        return True

    ### EVENT HANDLING ###
    def _add_event_listener(self, event_name: str, callback: Callable[..., Any]) -> EventSubscription:
        """Add a dynamic event listener for the given event name and return an EventSubscription to manage it."""
        listeners = self._event_listeners.setdefault(event_name, [])
        listeners.append(callback)

        def _remove() -> None:
            if callback in listeners:
                listeners.remove(callback)

        return EventSubscription(_remove)

    def _dispatch_event(self, event_name: str, args: Sequence[Any] = (), kwargs: dict[str, Any] | None = None) -> None:
        """Call the internal event handler and all dynamic event listeners for the given event name."""
        kwargs = kwargs or {}

        # 1. Call the internal event handler (registered with @event) if it exists
        internal_cb = type(self)._events_callback.get(event_name)
        if internal_cb is not None:
            internal_cb(self, *args, **kwargs)

        # 2. Call all dynamic event listeners (registered with @event_subscribe)
        # (Iterate over a copy, in case listeners are removed during iteration)
        for listener in list(self._event_listeners.get(event_name, [])):
            listener(*args, **kwargs)

    ### ANYWIDGET INTEGRATION ###
    def anywidget(self, single: bool = False) -> NeoscopeAnyWidget[Self]:
        """Create a NeoscopeAnyWidget instance from the model."""
        if single:
            return NeoscopeAnyWidget[Self].specialize(type(self))(model=self)
        if self._anywidget is None:
            self._anywidget = self.anywidget(single=True)
        return self._anywidget

    ### STREAMLIT INTEGRATION ###
    @classmethod
    def streamlit_component(cls) -> Callable[..., Any]:
        """Create a Streamlit widget from the model."""
        if hasattr(cls, "_streamlit_component"):
            return cls._streamlit_component
        widget_name = cls.widget_name()
        cls._streamlit_component = st.components.v2.component(
            name=f"neoscope.{widget_name}",
            html='<div class="react-root neoscope-widget"></div>',
            js=f"{widget_name}-streamlit.js",
            css=f"{widget_name}-streamlit.css",
        )
        return cls._streamlit_component

    def streamlit(self, key=None) -> Any:
        """Render the model as a Streamlit component."""
        component = self.streamlit_component()

        model_data = self.dump_flat_json()
        store = component(key=key, data=model_data, on_event_change=lambda: None)

        # If an event was triggered, dispatch it to the appropriate handler
        event_payload = store.get("event") if isinstance(store, dict) else getattr(store, "event", None)
        if isinstance(event_payload, dict) and "type" in event_payload:
            self._dispatch_event(
                event_payload["type"],
                args=event_payload.get("args", ()),
                kwargs=event_payload.get("kwargs", {}),
            )

        for field_name, value in model_data.items():
            if value is not None and store.get(field_name) != value:
                self.on_frontend_change(field_name, store.get(field_name))

    # TODO: bind _repr_* method to anywidget if in jupyter environment


################################################
# == NeoscopeAnyWidget ===

_FRONTEND_DATA_KEY = "_frontend_data"


class NeoscopeAnyWidget[MODEL: BaseWidgetModel](anywidget.AnyWidget):
    """Base class for all widgets in the neoscope package.
    This class provides a common interface for all widgets.
    """

    _frontend_data = traitlets.Dict().tag(sync=True)

    def __init__(self, model: MODEL):
        super().__init__()
        self._model = weakref.ref(model)
        setattr(self, _FRONTEND_DATA_KEY, model.dump_flat_json())
        # Bind the model to the widget so that changes in the model are reflected in the widget and vice versa.
        self.observe(self.on_frontend_change, names=[_FRONTEND_DATA_KEY])
        model.on_change(self.on_model_change, silenceable=True)

    def on_frontend_change(self, change):
        """Update the widget when the model changes."""
        model = self._model()
        if model is None or model._silence_change_notifications:
            return
        if change["name"] == _FRONTEND_DATA_KEY:
            for key, new_value in change["new"].items():
                if new_value != change["old"].get(key):
                    model.on_frontend_change(key, new_value)

    def on_model_change(self, field: str, value: Any):
        """Update the frontend when the model changes."""
        model = self._model()
        if model is None or model._silence_change_notifications:
            return
        #        with model._silence_change_notifications:
        setattr(self, _FRONTEND_DATA_KEY, model.dump_flat_json())

    def on_msg_received(self, msg, buffers):
        """Handle messages received from the frontend."""
        model = self._model()
        if model is None:
            return
        if (event_msg := msg.get("event", None)) is not None and isinstance(event_msg, dict):
            event_type = event_msg.get("type")
            if isinstance(event_type, str):
                model._dispatch_event(
                    event_type,
                    args=event_msg.get("args", []),
                    kwargs=event_msg.get("kwargs", {}),
                )

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


################################################
# === Example widget model: HelloButton ===
class HelloButton(BaseWidgetModel, widget="HelloButton"):
    value: int = 0

    @event_subscribe("click")
    def on_click(self, value: int) -> None:
        """Register a callback for the click event. The callback will receive the current value of the button."""
