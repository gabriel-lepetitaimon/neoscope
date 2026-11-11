from typing import Literal

from pydantic import Field

from ..base import BaseModel

type TransformMatrix = tuple[tuple[float, float, float], tuple[float, float, float]]
# fmt: off
type BlendMode = Literal[
    "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light",
    "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity", "plus-darker", "plus-lighter"
]
# fmt: on


class BaseLayer2D(BaseModel):
    # TODO: mark blend_mode, opacity and visibility as LayerParameter
    blend_mode: BlendMode | None = Field(default=None)
    opacity: float = 1.0
    transform: TransformMatrix = Field(default=((1, 0, 0), (0, 1, 0)))
    transform_origin: tuple[float, float, Literal["absolute", "relative"]] = Field(default=(0, 0, "absolute"))
    visibility: bool = True


# Layer Parameters:
#   valid_types: int (min, max), float (min, max), literal (list of str), str, color, color scale
#   label (str)
