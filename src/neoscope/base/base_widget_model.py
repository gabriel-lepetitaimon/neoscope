from __future__ import annotations

import functools
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, ParamSpec, Self

import pydantic

from .base_model import _DELETED, BaseModel

_WIDGET_KEY = "__WIDGET__"
P = ParamSpec("P")

if TYPE_CHECKING:
    from .anywidget import NeoscopeAnyWidget


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


class BaseWidgetModel(BaseModel):
    model_config = pydantic.ConfigDict(ignored_types=(EventSubscribeDescriptor,))

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

    ### STATE SYNCHRONIZATION ###
    def on_frontend_change(self, keys: str | Sequence[str], value) -> bool:
        """Update the widget when the model changes."""
        if self._silence_change_notifications:
            return False

        if isinstance(keys, str):
            keys = keys.split(".")

        curr: Any = self
        for k in keys[:-1]:
            curr = curr[k] if isinstance(curr, dict) else getattr(curr, k)

        last_key = keys[-1]

        # Suppression explicite d'une clé de dictionnaire
        if value == _DELETED:
            if isinstance(curr, dict) and last_key in curr:
                with self._silence_change_notifications:
                    del curr[last_key]
                return True
            return False

        with self._silence_change_notifications:
            try:
                if isinstance(curr, dict):
                    # Pydantic valide/convertit automatiquement si value est un dict représentant un BaseModel
                    curr[last_key] = value
                else:
                    setattr(curr, last_key, value)
            except pydantic.ValidationError:
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
        """Create a NeoscopeAnyWidget instance from the model.

        Parameters
        ----------
        single : bool, optional
            If True, create a new AnyWidget instance each time. If False, reuse the same AnyWidget instance for the model. Default is False.

        Returns
        -------
        NeoscopeAnyWidget[Self]
            An AnyWidget wrapper of this widget.
        """
        from .anywidget import render_anywidget

        if single:
            return render_anywidget(self)

        if self._anywidget is None:
            self._anywidget = render_anywidget(self)
        return self._anywidget

    ### STREAMLIT INTEGRATION ###
    @classmethod
    def streamlit_component(cls) -> Callable[..., Any]:
        """Create a Streamlit widget from the model."""
        from .streamlit import streamlit_component

        if not hasattr(cls, "_streamlit_component"):
            cls._streamlit_component = streamlit_component(cls.widget_name())
        return cls._streamlit_component

    def streamlit(self, key=None) -> Any:
        """Render the model as a Streamlit component."""
        from .streamlit import render_streamlit

        return render_streamlit(self, key=key)

    # TODO: bind _repr_* method to anywidget if in jupyter environment


################################################
# == Event subscription management ===
################################################
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

    def __exit__(self, *args: object) -> None:
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
