from collections.abc import Sequence
from typing import Any


def recursive_get(d: dict, keys: Sequence[Any], default=None) -> Any:
    """
    Get a value from a nested dictionary using a sequence of keys.

    Parameters
    ----------
    d : dict
        The dictionary to search.
    keys : Sequence[any]
        A sequence of keys to traverse the dictionary.
    default : any, optional
        The default value to return if the keys are not found. Default is None.

    Returns
    -------
    any
        The value found at the specified keys, or the default value if not found.
    """
    for key in keys:
        try:
            d = d[key]
        except (KeyError, TypeError):
            return default
    return d


class ContextFlag:
    """
    A simple context manager to set a flag to True when entering the context and reset it to False when exiting.
    """

    def __init__(self):
        self.flag = False

    def __enter__(self):
        self.flag = True

    def __exit__(self, exc_type, exc_value, traceback):
        self.flag = False

    def __bool__(self):
        return self.flag
