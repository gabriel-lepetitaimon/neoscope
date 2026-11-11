import base64
import os
import re
from pathlib import Path
from typing import Annotated, Literal, TypeAlias, overload

import numpy as np
from pydantic import BeforeValidator, PlainSerializer, WithJsonSchema
from pydantic_core import PydanticSerializationError, core_schema

from .color import Color, ColorLike


def load_image_from_url(url: str | Path):
    from .safe_import import cv2

    if isinstance(url, Path):
        url = str(url)
    if re.match(r"^https?://", url):
        from urllib.request import urlopen

        resp = urlopen(url)
        img = np.asarray(bytearray(resp.read()), dtype=np.uint8)
        img = cv2.imdecode(img, -1)
        if img is None:
            raise ValueError(f"Invalid image url: {url}.")
    elif re.match(r"^data:image/(png|jpeg|jpg);base64,", url):
        encoded = url.split(",", 1)[1]
        img = np.asarray(bytearray(base64.b64decode(encoded)), dtype=np.uint8)
        img = cv2.imdecode(img, -1)
        if img is None:
            raise ValueError(f"Invalid image data url: {url}.")
    elif os.path.exists(url):
        img = cv2.imread(url)
        if img is None:
            raise ValueError(f"Invalid image file: {url}.") from None
    else:
        raise ValueError(f"No file was found at: {url}.")

    if img.ndim == 3:
        img = img[:, :, ::-1]
    return img


@overload
def encode_image_to_base64(img: np.ndarray, ext: str = "jpg", *, format: Literal["bytes"]) -> bytes: ...
@overload
def encode_image_to_base64(img: np.ndarray, ext: str = "jpg", *, format: Literal["url", "neoscope"] = "url") -> str: ...
def encode_image_to_base64(
    img: np.ndarray, ext: str = "jpg", *, format: Literal["bytes", "url", "neoscope"] = "url"
) -> str | bytes:
    from .safe_import import cv2

    if img.ndim == 3:
        img = img[:, :, ::-1]
    _, buffer = cv2.imencode("." + ext, img)
    if buffer is None:
        raise ValueError("Failed to encode image to base64.")
    match format:
        case "bytes":
            return base64.b64encode(buffer)
        case "url":
            return "data:image/" + ext + ";base64," + base64.b64encode(buffer).decode("ascii")
        case "neoscope":
            return f"{img.shape[0]},{img.shape[1]},{ext}|" + base64.b64encode(buffer).decode("ascii")
        case _:
            raise ValueError(f"Invalid format: {format}. Choose from 'bytes' or 'url'.")


def checkerboard(
    shape: tuple[int, int],
    square_size: tuple[int, int] = (10, 10),
    color1: ColorLike = "white",
    color2: ColorLike = "black",
) -> np.ndarray:
    """Create a checkerboard image.

    Parameters
    ----------
        shape : tuple[int, int]
            Shape of the image (height, width).

        square_size : tuple[int, int]
            Size of the each individual square (height, width).

        color1 : str
            Color of the first square.

        color2 : str
            Color of the second square.

    """
    shape_ = shape + (3,)
    tile12 = np.concatenate(
        [
            np.full(square_size + (3,), Color(color1), dtype=np.uint8),
            np.full(square_size + (3,), Color(color2), dtype=np.uint8),
        ],
        axis=1,
    )
    tile = np.concatenate([tile12, tile12[:, ::-1]], axis=0)

    img = np.tile(tile, [shape_[0] // (2 * square_size[0]) + 1, shape_[1] // 2 * (square_size[1]) + 1, 1])
    return img[: shape_[0], : shape_[1]]


def _validate_image_field(obj: object) -> np.ndarray:
    """Validate that the object is an image-like object.

    Parameters
    ----------
        obj : object
            Object to validate.

    Returns
    -------
        np.ndarray
            The validated image.

    Raises
    ------
        ValueError
            If the object is not an image-like object.
    """
    if isinstance(obj, (str, Path)):
        try:
            return load_image_from_url(obj)
        except Exception as e:
            raise PydanticSerializationError(f"Failed to load image: {e}") from e
    elif isinstance(obj, np.ndarray):
        if obj.ndim not in (2, 3):
            raise ValueError("Array must be 2D or 3D.")
        if obj.dtype not in (np.uint8, np.float32):
            raise ValueError("Array must be of type uint8 or float32.")
        return obj

    raise TypeError("The provided object is not an image-like object.")


def _serialize_image_field(image) -> str:
    """Serialize an image-like object to a base64 string.

    Parameters
    ----------
        obj : np.ndarray
            Numpy array to serialize.

    Returns
    -------
        list
            The serialized list.
    """
    if isinstance(image, (str, Path)):
        try:
            image = load_image_from_url(image)
        except Exception as e:
            raise PydanticSerializationError(f"Failed to load image: {e}") from e
    if isinstance(image, np.ndarray):
        try:
            return encode_image_to_base64(image, ext="jpg", format="neoscope")
        except Exception as e:
            raise PydanticSerializationError(f"Failed to encode image to base64: {e}") from e
    raise PydanticSerializationError(f"Invalid image type: {type(image)}. Must be str, Path, or np.ndarray.")


class _ImageLikePydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler) -> core_schema.CoreSchema:
        # We use an 'any' schema to swallow the input safely, and pass it downstream to _validate_image_field
        if source_type is not None and not issubclass(source_type, (str, Path, np.ndarray)):
            raise TypeError(f"Invalid source type for ImageField: {source_type}. Must be str, Path, or np.ndarray.")
        return core_schema.chain_schema([core_schema.any_schema()])


type ImageField = Annotated[
    np.ndarray,
    _ImageLikePydanticAnnotation,
    BeforeValidator(_validate_image_field, json_schema_input_type=str),
    PlainSerializer(_serialize_image_field, return_type=str),
    WithJsonSchema({"type": "string", "format": "data-url"}),
]
