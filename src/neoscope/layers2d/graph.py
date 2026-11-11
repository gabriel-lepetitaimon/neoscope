from typing import Literal

from neoscope.utils.image import ImageLikeField, MapLikeField

from .layer2d_base import BaseLayer2D

# fmt: off
type Symbol = Literal['asterisk', 'circle', 'cross', 'diamond', 'diamond2', 'plus', 'square', 'square2', 'star', 'triangle', 'triangle2', 'wye', 'times']
# fmt: on


class GraphLayer(BaseLayer2D):
    node_pos: list[tuple[int, int]]  # TODO: Field accepting numpy array
    branch_list: list[tuple[int, int]]
    branch_curves: list[list[tuple[int, int]]]
    branch_paths: list[BezierPath]

    # Parameters
    node_symbol: Symbol | list[Symbol] = "circle"
    node_color: Color | List[Color]
    node_stroke_color: Color | List[Color]
