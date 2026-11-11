import textwrap
from typing import Annotated, Literal

import numpy as np
import pydantic
from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema
from pydantic_core import PydanticSerializationError, core_schema

type UInt8TripletOrQuad = np.ndarray[tuple[Literal[3, 4]], np.dtype[np.uint8]]
type RGBColorSpec = (
    tuple[int, int, int] | tuple[float, float, float] | np.ndarray[tuple[Literal[3]], np.dtype[np.number]]
)
type RGBAColorSpec = (
    tuple[int, int, int, int] | tuple[float, float, float, float] | np.ndarray[tuple[Literal[4]], np.dtype[np.number]]
)
type ColorLike = RGBColorSpec | RGBAColorSpec | str


class Color(np.ndarray[tuple[Literal[3, 4]], np.dtype[np.uint8]]):
    """A utility class for handling colors in various formats (RGB, HEX, etc.) and converting between them."""

    def __new__(cls, color: ColorLike):
        arr = cls.parse(color)
        obj = np.asarray(arr, dtype=np.uint8).view(cls)
        return obj

    def __str__(self) -> str:
        try:
            return self.to_name()
        except ValueError:
            return self.to_hex()

    def __repr__(self) -> str:
        return f'Color("{self!s}")'

    def to_hex(self) -> str:
        """Convert the color to a HEX string."""
        return "#" + "".join(f"{c:02x}" for c in self)

    def to_name(self) -> str:
        """Convert the color to a named color string if possible."""
        import webcolors

        try:
            return webcolors.rgb_to_name(tuple(self[:3]))
        except ValueError:
            raise ValueError(f"Color {self.to_hex()} does not have a named representation.") from None

    @classmethod
    def parse(cls, color: ColorLike) -> UInt8TripletOrQuad:
        """Parse a color specification and return a Color instance."""
        if isinstance(color, str):
            color = color.strip().lower()
            if color.startswith("#"):
                color = color[1:]
                if len(color) in (3, 4):
                    return np.array([int(c * 2, 16) for c in color], dtype=np.uint8)
                elif len(color) in (6, 8):
                    return np.array([int(c, 16) for c in textwrap.wrap(color, 2)], dtype=np.uint8)
                else:
                    raise ValueError(f"Invalid HEX color: {color}")
            else:
                import webcolors

                try:
                    return np.array(webcolors.name_to_rgb(color), dtype=np.uint8)
                except ValueError:
                    raise ValueError(f"Invalid color name: {color}") from None

        elif isinstance(color, (tuple, np.ndarray)):
            arr = np.asarray(color)
            if arr.ndim != 1 or arr.size not in (3, 4):
                raise ValueError(f"Invalid color array shape: {arr.shape}. Must be 1D with 3 or 4 elements.")
            if np.issubdtype(arr.dtype, np.floating):
                arr = (arr * 255).astype(np.uint8)
            elif not np.issubdtype(arr.dtype, np.integer):
                raise ValueError(f"Invalid color array dtype: {arr.dtype}. Must be integer or float.")
            return np.clip(arr, 0, 255).astype(np.uint8)
        else:
            raise TypeError(f"Invalid color specification: {color}")

    @classmethod
    def serialize(cls, color: ColorLike) -> str:
        """Serialize a Color instance to a HEX string."""
        if isinstance(color, cls):
            return color.to_hex()
        else:
            return cls.parse(color).view(cls).to_hex()


class _ColorLikePydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler) -> core_schema.CoreSchema:
        # We use an 'any' schema to swallow the input safely, and pass it downstream to _validate_image_field
        if source_type is not None and not issubclass(source_type, (str, tuple, np.ndarray)):
            raise TypeError(f"Invalid source type for ColorField: {source_type}. Must be str, tuple, or np.ndarray.")
        return core_schema.chain_schema([core_schema.any_schema()])


type ColorField = Annotated[
    Color,
    _ColorLikePydanticAnnotation,
    BeforeValidator(Color.parse, json_schema_input_type=ColorLike),
    PlainSerializer(Color.serialize, return_type=str),
    WithJsonSchema({"type": "string"}),
]

########################################################################################################################
