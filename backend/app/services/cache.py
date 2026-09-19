from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: float


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int, clock: Callable[[], float] = monotonic) -> None:
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._entries: dict[str, CacheEntry[T]] = {}

    def get_fresh(self, key: str) -> T | None:
        entry = self._entries.get(key)
        if entry is None or entry.expires_at <= self.clock():
            return None
        return entry.value

    def get_any(self, key: str) -> T | None:
        entry = self._entries.get(key)
        return entry.value if entry else None

    def set(self, key: str, value: T) -> None:
        self._entries[key] = CacheEntry(value=value, expires_at=self.clock() + self.ttl_seconds)

