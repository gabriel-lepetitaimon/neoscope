import textwrap
from typing import Literal, TypeAlias

import numpy as np

UInt8TripletOrQuad: TypeAlias = np.ndarray[tuple[Literal[3, 4]], np.dtype[np.uint8]]
RGBColorSpec: TypeAlias = (
    tuple[int, int, int] | tuple[float, float, float] | np.ndarray[tuple[Literal[3]], np.dtype[np.number]]
)
RGBAColorSpec: TypeAlias = (
    tuple[int, int, int, int] | tuple[float, float, float, float] | np.ndarray[tuple[Literal[4]], np.dtype[np.number]]
)
ColorLike: TypeAlias = RGBColorSpec | RGBAColorSpec | str


class Color(UInt8TripletOrQuad):
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
