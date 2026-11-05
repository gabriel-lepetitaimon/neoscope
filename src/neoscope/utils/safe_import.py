from __future__ import annotations

import os
from types import ModuleType
from typing import TYPE_CHECKING

_cv2 = None


_cv2 = None

if TYPE_CHECKING:
    import cv2


def __getattr__(name: str) -> ModuleType:
    match name:
        case "cv2":
            module = import_cv2()
        case _:
            raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    globals()[name] = module
    return module


def is_cv2_available() -> bool:
    """Check if cv2 is available in the current python environment.

    Returns
    -------
        bool: True if cv2 is available, False otherwise.
    """
    global _cv2
    if _cv2 is None:
        try:
            os.environ["OPENCV_LOG_LEVEL"] = "ERROR"

            import cv2

            _cv2 = cv2
            return True
        except ImportError:
            _cv2 = False
            return False
    return _cv2 is not False


def import_cv2() -> ModuleType:
    if is_cv2_available():
        return _cv2  # type: ignore[return-value]
    else:
        raise ImportError(  # noqa: B904
            "cv2 is not available in the current python environment.\n"
            "\t This package is required by neoscope but "
            "we can't add it to the dependencies to prevent versions conflict.\n"
            "\t Please install it by yourself using `pip install opencv-python-headless`."
        )
