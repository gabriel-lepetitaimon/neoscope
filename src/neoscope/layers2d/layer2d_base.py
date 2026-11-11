from typing import ClassVar, Literal

from pydantic import Field, computed_field

from ..base import BaseModel

type TransformMatrix = tuple[tuple[float, float, float], tuple[float, float, float]]
# fmt: off
type BlendMode = Literal[
    "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light",
    "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity", "plus-darker", "plus-lighter"
]
# fmt: on


class BaseLayer2D(BaseModel):
    _layer_type: ClassVar[str]

    def __init_subclass__(cls, *, layer_type: str | None = None, **kwargs):
        super().__init_subclass__(**kwargs)
        if layer_type is not None:
            cls._layer_type = layer_type
        elif not hasattr(cls, "_layer_type"):
            raise TypeError(f"{cls.__name__} must define a 'layer_type' class argument")

    @computed_field
    @property
    def layer_type(self) -> str:
        return self._layer_type

    # TODO: mark blend_mode, opacity and visibility as LayerParameter
    blend_mode: BlendMode = Field(default="normal")
    opacity: float = 1.0
    transform: TransformMatrix = Field(default=((1, 0, 0), (0, 1, 0)))
    transform_origin: tuple[float, float, Literal["absolute", "relative"]] = Field(default=(0, 0, "absolute"))
    visibility: bool = True
    z_index: int | None = 0


# Layer Parameters:
#   valid_types: int (min, max), float (min, max), literal (list of str), str, color, color scale
#   label (str)
