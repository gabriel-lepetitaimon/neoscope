from __future__ import annotations

import functools
from collections.abc import Callable, Sequence
from typing import Any

import pydantic

from neoscope.utils import ContextFlag

_DELETED = {"__deleted__": True}


def is_deleted(value: Any) -> bool:
    return value is _DELETED or (isinstance(value, dict) and value.get("__deleted__") is True)


class BaseModel(pydantic.BaseModel):
    """A base model that watches for changes in its fields and triggers a callback."""

    model_config = pydantic.ConfigDict(validate_assignment=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._watchers: list[tuple[str, bool, Any]] = []
        self._silence_change_notifications = ContextFlag()
        for field_name in type(self).model_fields:
            self._bind_field_watcher(field_name, getattr(self, field_name))

    def _bind_field_watcher(self, field_name: str, value: Any) -> None:
        """Bind a watcher to a field if the value is a BaseModel or a dict. This allows nested models to notify the parent model of changes."""
        if isinstance(value, BaseModel):
            value.on_change(self._notify_watchers, prefix=f"{field_name}.", silenceable=False)
        elif isinstance(value, dict) and not isinstance(value, _WatchedDict):
            watched = _WatchedDict(
                value,
                on_mutate=lambda sub_key, sub_val, f=field_name: self._notify_watchers(
                    f"{f}.{sub_key}" if sub_key else f, sub_val
                ),
                on_delete=lambda sub_key, f=field_name: self._notify_watchers(f"{f}.{sub_key}", _DELETED),
            )
            super().__setattr__(field_name, watched)

    def on_change(self, callback: Callable[[str, Any], None], prefix: str = "", silenceable: bool = False) -> None:
        """Add a watcher callback that will be called when the model changes.
        The callback will be called with the name of the field that changed and its new value.
        """
        self._watchers.append((prefix, silenceable, callback))

    def _notify_watchers(self, field: str, value: Any) -> None:
        """Notify all watchers of a change in the model."""
        for watcher_prefix, silenceable, watcher in self._watchers:
            # watcher = watcher_ref()
            if watcher is not None and (not silenceable or not self._silence_change_notifications):
                watcher(f"{watcher_prefix}{field}", value)

    def __setattr__(self, name: str, value: Any) -> None:
        if name in type(self).model_fields:
            old_value = getattr(self, name, None)
            super().__setattr__(name, value)  # Set value applying pydantic validation
            new_value = getattr(self, name)

            self._bind_field_watcher(name, new_value)
            if old_value is not new_value:
                self._notify_watchers(field=name, value=new_value)
        else:
            super().__setattr__(name, value)

    def serialize_field(self, field_path: str | Sequence[str]) -> Any:
        if isinstance(field_path, str):
            field_path = field_path.split(".")
        include: Any = functools.reduce(lambda acc, f: {f: acc}, reversed(field_path), True)

        curr = self.model_dump(mode="json", include=include)
        for f in field_path:
            curr = curr[f]

        return curr

    def dump_flat_json(self, *, sep: str = ".", prefix: str = "") -> dict[str, Any]:
        """Aplatit le modèle pour l'état initial complet."""
        flat: dict[str, Any] = {}
        serialized = self.model_dump(mode="json")

        for field_name in type(self).model_fields:
            key = f"{prefix}{sep}{field_name}" if prefix else field_name
            val = getattr(self, field_name)
            ser_val = serialized.get(field_name)

            if isinstance(val, BaseModel):
                flat.update(val.dump_flat_json(sep=sep, prefix=key))
            elif isinstance(val, dict) and any(isinstance(v, BaseModel) for v in val.values()):
                assert ser_val is not None, f"Serialized value for field {field_name} is None"
                for dict_key, dict_item in val.items():
                    item_prefix = f"{key}{sep}{dict_key}"
                    if isinstance(dict_item, BaseModel):
                        flat.update(dict_item.dump_flat_json(sep=sep, prefix=item_prefix))
                    else:
                        flat[item_prefix] = ser_val.get(dict_key)
            else:
                flat[key] = ser_val

        return flat


class _WatchedDict(dict):
    """Dictionnaire observable séparant mutations et suppressions."""

    def __init__(
        self,
        initial: dict[str, Any],
        on_mutate: Callable[[str, Any], None],
        on_delete: Callable[[str], None],
    ):
        super().__init__()
        self._on_mutate = on_mutate
        self._on_delete = on_delete
        for k, v in initial.items():
            super().__setitem__(k, self._wrap_item(k, v))

    def _wrap_item(self, key: str, value: Any) -> Any:
        if isinstance(value, BaseModel):
            value.on_change(self._on_mutate, prefix=f"{key}.", silenceable=False)
        return value

    def __setitem__(self, key: str, value: Any) -> None:
        wrapped = self._wrap_item(key, value)
        super().__setitem__(key, wrapped)
        self._on_mutate(key, wrapped)

    def __delitem__(self, key: str) -> None:
        super().__delitem__(key)
        self._on_delete(key)

    def pop(self, key: str, *args: Any) -> Any:
        existed = key in self
        res = super().pop(key, *args)
        if existed:
            self._on_delete(key)
        return res

    def clear(self) -> None:
        keys = list(self.keys())
        super().clear()
        for k in keys:
            self._on_delete(k)
