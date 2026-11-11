from .base_model import BaseModel
from .base_widget_model import BaseWidgetModel, event, event_subscribe


class HelloButton(BaseWidgetModel, widget="HelloButton"):
    value: int = 0

    @event_subscribe("click")
    def on_click(self, value: int) -> None:
        """Register a callback for the click event. The callback will receive the current value of the button."""
