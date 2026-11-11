from .base import BaseWidgetModel, event
from .utils.image import ImageField


class ImageViewer(BaseWidgetModel, widget="ImageViewer"):
    """Model for the ImageViewer widget."""

    image: ImageField

    @event("click")
    def on_click(self, y: int, x: int) -> None:
        """Event handler for click events on the image.

        Args:
            y (int): The y-coordinate of the click event.
            x (int): The x-coordinate of the click event.
        """
        pass
