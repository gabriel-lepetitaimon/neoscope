from __future__ import annotations

from pydantic import Field

from .base import BaseWidgetModel, event
from .layers2d.layer2d_base import BaseLayer2D


class View2D(BaseWidgetModel, widget="View2D"):
    """Model for the View2D widget.

    Layers can be accessed, added and removed using the dictionary-like interface of the model.
    """

    layers: dict[str, BaseLayer2D] = Field(default_factory=dict)
    """ A dictionary of layers to be displayed in the image viewer. The keys are the layer names, and the values are the layer objects. Each layer can be of a different type, such as ColorMap, IntensityMap, LabelMap, or InstanceMap. The layers will be rendered according to their z_index. """

    @event("click")
    def on_click(self, y: int, x: int) -> None:
        """Event handler for click events on the image.

        Args:
            y (int): The y-coordinate of the click event.
            x (int): The x-coordinate of the click event.
        """
        pass

    def add_layer(self, name: str, layer: BaseLayer2D) -> None:
        """Add a layer to the image viewer.

        Args:
            name (str): The name of the layer.
            layer (BaseLayer2D): The layer object to be added.
        """
        if layer.z_index is None:
            if self.layers:
                layer.z_index = max(layer.z_index for layer in self.layers.values() if layer.z_index is not None) + 1
            else:
                layer.z_index = 0
        self.layers[name] = layer

    def __setitem__(self, key, value: BaseLayer2D) -> None:
        self.add_layer(key, value)

    def __getitem__(self, key) -> BaseLayer2D:
        return self.layers[key]

    def __delitem__(self, key) -> None:
        del self.layers[key]
