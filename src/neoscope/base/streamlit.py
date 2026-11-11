from collections.abc import Callable
from typing import Any

from ..utils.safe_import import streamlit as st
from .base_widget_model import BaseWidgetModel


def streamlit_component(widget_name: str) -> Callable[..., Any]:
    return st.components.v2.component(
        name=f"neoscope.{widget_name}",
        html='<div class="react-root neoscope-widget"></div>',
        js=f"{widget_name}-streamlit.js",
        css=f"{widget_name}-streamlit.css",
    )


def render_streamlit(widget: BaseWidgetModel, key=None) -> Any:
    """Render a NeoscopeAnyWidget in Streamlit."""
    component = widget.streamlit_component()

    model_data = widget.dump_flat_json()
    store = component(key=key, data=model_data, on_event_change=lambda: None)

    # If an event was triggered, dispatch it to the appropriate handler
    event_payload = store.get("event") if isinstance(store, dict) else getattr(store, "event", None)
    if isinstance(event_payload, dict) and "type" in event_payload:
        widget._dispatch_event(
            event_payload["type"],
            args=event_payload.get("args", ()),
            kwargs=event_payload.get("kwargs", {}),
        )

    for field_name, value in model_data.items():
        if value is not None and store.get(field_name) != value:
            widget.on_frontend_change(field_name, store.get(field_name))
