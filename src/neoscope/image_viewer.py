from .base import BaseWidgetModel
from .utils.image import ImageLikeField


class ImageViewer(BaseWidgetModel, widget="ImageViewer"):
    """Model for the ImageViewer widget."""

    image: ImageLikeField
