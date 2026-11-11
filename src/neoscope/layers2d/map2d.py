from typing import Literal

import pandas as pd

from neoscope.utils.image import ImageField  # , MapLikeField

from .layer2d_base import BaseLayer2D


class ColorMapLayer(BaseLayer2D, layer_type="ColorMap"):
    image: ImageField


# class IntensityMap(BaseLayer2D):
#     map: MapLikeField
#     scale: ColorScale


# class LabelMap(BaseLayer2D):
#     map: MapLikeField
#     labels: list[str] | None
#     colors: list[Color] | Color


# class InstanceMap(BaseLayer2D):
#     map: MapLikeField
#     labels: list[str] | None
#     colors: list[Color] | Color
#     attr: pd.DataFrame
