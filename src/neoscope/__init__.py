import pathlib
import tomllib
from functools import reduce

from IPython.display import display
from ipywidgets import HTML

from .utils import recursive_get

_ROOT = pathlib.Path(__file__).parent

try:
    with open(_ROOT / "pyproject.toml", "rb") as f:
        meta = tomllib.load(f)
except Exception:
    __version__ = "unknown"
    __asset_dir__ = _ROOT / "static"
else:
    __version__ = recursive_get(meta, ("project", "version"), default="unknown")
    _asset_dir = recursive_get(meta, ("tool", "streamlit", "component", "components", "asset_dir"), default="static")
    __asset_dir__ = _ROOT / _asset_dir


def vscode_theme():
    # Redefine root variables colors to match VSCode theme
    root_vars = {}
    root_vars["jp-widgets-color"] = "neoscope-foreground-color"

    root_vars["jp-widgets-slider-handle-border-color"] = (("vscode-input-border", "jp-border-color"),)
    root_vars["jp-widgets-slider-handle-background-color"] = (
        "vscode-scrollbarSlider-background",
        "jp-layout-color1",
    )
    root_vars["jp-widgets-slider-active-handle-color"] = ("vscode-focusBorder", "jp-brand-color1")

    root_vars["jp-widgets-input-color"] = ("vscode-input-foreground", "jp-ui-font-color1")
    root_vars["jp-widgets-input-background-color"] = ("vscode-input-background", "jp-layout-color1")
    root_vars["jp-widgets-input-border-color"] = ("vscode-input-border", "jp-border-color")
    root_vars["jp-widgets-slider-active-handle-color"] = ("vscode-inputOption-activeForeground", "jp-brand-color1")
    root_vars["jp-widgets-input-focus-border-color"] = ("vscode-inputOption-activeBorder", "jp-brand-color2")

    root_vars_css = "\n".join(
        f"    --{var_name}: "
        + reduce(lambda x, y: f"var(--{y}, {x})", reversed(var_values[:-1]), f"var(--{var_values[-1]})")
        + ";"
        for var_name, var_values in root_vars.items()
    )

    # Background disabling
    background_css = """
    .cell-output-ipywidget-background {
            background: transparent !important;
    }"""

    theme = (
        "<style>"
        + background_css
        + """
        :root {"""
        + root_vars_css
        + """
        }
        </style>"""
    )

    display(HTML(theme))
