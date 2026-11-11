from __future__ import annotations

import os
from types import ModuleType
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import anywidget
    import cv2
    import streamlit
    import traitlets


def __getattr__(name: str) -> ModuleType:
    match name:
        case "cv2":
            module = import_cv2()
        case "anywidget":
            module = import_anywidget()
        case "streamlit":
            module = import_streamlit()
        case "traitlets":
            module = import_traitlets()
        case _:
            raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    globals()[name] = module
    return module


def import_cv2() -> ModuleType:
    try:
        os.environ["OPENCV_LOG_LEVEL"] = "ERROR"

        import cv2
    except ImportError:
        raise ImportError(  # noqa: B904
            "cv2 is not available in the current python environment.\n"
            "\t This package is required by neoscope but "
            "we can't add it to the dependencies to prevent versions conflict.\n"
            "\t Please install it by yourself using `pip install opencv-python-headless`."
        )
    return cv2


def import_anywidget() -> ModuleType:
    try:
        import anywidget
    except ImportError:
        raise ImportError(
            "anywidget is not available in the current python environment.\n"
            "\t If you want to use the AnyWidget feature of neoscope, please run `pip install anywidget` or `pip install neoscope[anywidget]`."
        )
    return anywidget


def import_traitlets() -> ModuleType:
    try:
        import traitlets
    except ImportError:
        raise ImportError(
            "traitlets is not available in the current python environment.\n"
            "\t If you want to use the AnyWidget feature of neoscope, please run `pip install anywidget` or `pip install neoscope[anywidget]`."
        )
    return traitlets


def import_streamlit() -> ModuleType:
    try:
        import streamlit
    except ImportError:
        raise ImportError(
            "streamlit is not available in the current python environment.\n"
            "\t If you want to use the Streamlit feature of neoscope, please run `pip install streamlit` or `pip install neoscope[streamlit]`."
        )
    return streamlit
