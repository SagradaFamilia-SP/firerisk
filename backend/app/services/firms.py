import csv
import hashlib
import io
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import httpx

from app.core.config import Settings, get_settings
from app.schemas.fires import (
    FireConfidence,
    FireDetection,
    FireMeta,
    FireQuery,
    FireResponse,
    FirmsSource,
    WmsQuery,
)
from app.services.cache import TTLCache


class FirmsError(RuntimeError):
    pass


class FirmsNotConfiguredError(FirmsError):
    pass


class FirmsUnavailableError(FirmsError):
    pass


CONFIDENCE_RANK: dict[FireConfidence, int] = {"low": 0, "nominal": 1, "high": 2}


def _float(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    return float(value)


def parse_firms_csv(csv_text: str, source: FirmsSource) -> list[FireDetection]:
    detections: list[FireDetection] = []
    for row in csv.DictReader(io.StringIO(csv_text)):
        try:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                continue
            acquired_at = datetime.strptime(
                f"{row['acq_date']} {row['acq_time'].zfill(4)}", "%Y-%m-%d %H%M"
            ).replace(tzinfo=UTC)
            confidence: FireConfidence = {"l": "low", "n": "nominal", "h": "high"}.get(
                row.get("confidence", "").strip().lower(), "low"
            )  # type: ignore[assignment]
            daynight = "night" if row.get("daynight", "").strip().upper() == "N" else "day"
            identity = "|".join(
                (
                    f"{latitude:.4f}",
                    f"{longitude:.4f}",
                    acquired_at.isoformat(),
                    row.get("satellite", ""),
                )
            )
            detections.append(
                FireDetection(
                    id=hashlib.sha256(identity.encode()).hexdigest()[:20],
                    latitude=latitude,
                    longitude=longitude,
                    acquired_at=acquired_at,
                    satellite=row.get("satellite", "unknown"),
                    instrument=row.get("instrument", "VIIRS"),
                    source=source,
                    confidence=confidence,
                    brightness=float(row["bright_ti4"]),
                    brightness_ti5=_float(row.get("bright_ti5")),
                    frp=_float(row.get("frp")),
                    scan=_float(row.get("scan")),
                    track=_float(row.get("track")),
                    daynight=daynight,
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return detections


def deduplicate_detections(detections: list[FireDetection]) -> list[FireDetection]:
    unique: dict[str, FireDetection] = {}
    for detection in detections:
        unique[detection.id] = detection
    return sorted(unique.values(), key=lambda item: item.acquired_at, reverse=True)


def split_bounds(west: float, south: float, east: float, north: float) -> list[tuple[float, float, float, float]]:
    if west < east:
        return [(west, south, east, north)]
    return [(west, south, 180, north), (-180, south, east, north)]


class FirmsService:
    def __init__(
        self,
        settings: Settings,
        data_cache: TTLCache[FireResponse] | None = None,
        wms_cache: TTLCache[tuple[bytes, str]] | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.settings = settings
        self.data_cache = data_cache or TTLCache(settings.firms_data_cache_ttl_seconds)
        self.wms_cache = wms_cache or TTLCache(settings.firms_wms_cache_ttl_seconds)
        self.now = now

    async def fetch_detections(self, query: FireQuery) -> FireResponse:
        if not self.settings.nasa_firms_map_key:
            raise FirmsNotConfiguredError("FIRMS no está configurado")
        cache_key = self._data_cache_key(query)
        if cached := self.data_cache.get_fresh(cache_key):
            result = cached.model_copy(deep=True)
            result.meta.cache = "hit"
            result.meta.stale = False
            return result

        try:
            detections: list[FireDetection] = []
            day_range = query.hours // 24
            async with httpx.AsyncClient(timeout=20.0) as client:
                for source in sorted(set(query.sources)):
                    for bounds in split_bounds(query.west, query.south, query.east, query.north):
                        area = ",".join(f"{value:g}" for value in bounds)
                        response = await client.get(
                            f"{self.settings.firms_base_url}/api/area/csv/"
                            f"{self.settings.nasa_firms_map_key}/{source}/{area}/{day_range}"
                        )
                        response.raise_for_status()
                        detections.extend(parse_firms_csv(response.text, source))
            threshold = self.now() - timedelta(hours=query.hours)
            minimum = CONFIDENCE_RANK[query.min_confidence]
            filtered = [
                item
                for item in detections
                if item.acquired_at >= threshold and CONFIDENCE_RANK[item.confidence] >= minimum
            ]
            normalized = deduplicate_detections(filtered)
            result = FireResponse(
                detections=normalized,
                meta=FireMeta(
                    sources=sorted(set(query.sources)),
                    requested_hours=query.hours,
                    fetched_at=self.now(),
                    latest_acquisition=normalized[0].acquired_at if normalized else None,
                    count=len(normalized),
                    cache="miss",
                ),
            )
            self.data_cache.set(cache_key, result.model_copy(deep=True))
            return result
        except (httpx.HTTPError, ValueError, csv.Error) as exc:
            if stale := self.data_cache.get_any(cache_key):
                result = stale.model_copy(deep=True)
                result.meta.stale = True
                result.meta.cache = "hit"
                return result
            raise FirmsUnavailableError("NASA FIRMS no está disponible") from exc

    async def fetch_wms(self, query: WmsQuery) -> tuple[bytes, str, bool]:
        if not self.settings.nasa_firms_map_key:
            raise FirmsNotConfiguredError("FIRMS no está configurado")
        cache_key = query.model_dump_json(exclude_none=True)
        if cached := self.wms_cache.get_fresh(cache_key):
            return cached[0], cached[1], True

        params = query.model_dump(exclude_none=True)
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    f"{self.settings.firms_base_url}/mapserver/wms/fires/"
                    f"{self.settings.nasa_firms_map_key}/",
                    params=params,
                )
                response.raise_for_status()
            content_type = response.headers.get("content-type", "image/png").split(";", 1)[0]
            if content_type != "image/png":
                raise FirmsUnavailableError("NASA FIRMS devolvió una imagen inválida")
            value = (response.content, content_type)
            self.wms_cache.set(cache_key, value)
            return value[0], value[1], False
        except httpx.HTTPError as exc:
            if stale := self.wms_cache.get_any(cache_key):
                return stale[0], stale[1], True
            raise FirmsUnavailableError("NASA FIRMS no está disponible") from exc

    @staticmethod
    def _data_cache_key(query: FireQuery) -> str:
        return "|".join(
            (
                f"{query.west:.4f},{query.south:.4f},{query.east:.4f},{query.north:.4f}",
                ",".join(sorted(set(query.sources))),
                str(query.hours),
                query.min_confidence,
            )
        )


_service: FirmsService | None = None


def get_firms_service() -> FirmsService:
    global _service
    if _service is None:
        _service = FirmsService(get_settings())
    return _service
