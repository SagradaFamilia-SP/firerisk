import asyncio
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


def _in_bbox(lat: float, lon: float, west: float, south: float, east: float, north: float) -> bool:
    if not (south <= lat <= north):
        return False
    if west <= east:
        return west <= lon <= east
    # Antimeridian-crossing viewport (e.g. west=170, east=-170).
    return lon >= west or lon <= east


MAX_QUERY_HOURS = 72


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
        # Populated by refresh_master(), which a background task (see
        # app/main.py) runs on a timer independent of any request. Once this
        # has data, fetch_detections serves every viewport purely by
        # filtering it in memory — no NASA call and no CSV parse on the
        # request path at all, which is the whole point: a user opening the
        # map should never be the one who pays for that round trip.
        self._master_by_source: dict[FirmsSource, list[FireDetection]] = {}
        self._master_updated_at: datetime | None = None

    async def refresh_master(self) -> None:
        """Fetches the full world dataset for every known source and swaps
        it in atomically. Meant to be called on a timer by a background task,
        never from the request path."""
        if not self.settings.nasa_firms_map_key:
            return
        day_range = MAX_QUERY_HOURS // 24 + 1
        sources: list[FirmsSource] = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]

        async def fetch_source(client: httpx.AsyncClient, source: FirmsSource) -> tuple[FirmsSource, list[FireDetection]]:
            response = await client.get(
                f"{self.settings.firms_base_url}/api/area/csv/"
                f"{self.settings.nasa_firms_map_key}/{source}/-180,-90,180,90/{day_range}"
            )
            response.raise_for_status()
            detections = await asyncio.to_thread(parse_firms_csv, response.text, source)
            return source, await asyncio.to_thread(deduplicate_detections, detections)

        async with httpx.AsyncClient(timeout=60.0) as client:
            results = await asyncio.gather(
                *(fetch_source(client, source) for source in sources), return_exceptions=True
            )
        for outcome in results:
            if isinstance(outcome, BaseException):
                continue
            source, detections = outcome
            self._master_by_source[source] = detections
        if any(not isinstance(outcome, BaseException) for outcome in results):
            self._master_updated_at = self.now()

    async def fetch_detections(self, query: FireQuery) -> FireResponse:
        if not self.settings.nasa_firms_map_key:
            raise FirmsNotConfiguredError("FIRMS no está configurado")
        if self._master_updated_at is not None:
            return await self._serve_from_master(query)
        return await self._fetch_live(query)

    async def _serve_from_master(self, query: FireQuery) -> FireResponse:
        threshold = self.now() - timedelta(hours=query.hours)
        minimum = CONFIDENCE_RANK[query.min_confidence]
        west, south, east, north = query.west, query.south, query.east, query.north
        wanted = set(query.sources)

        def build() -> list[FireDetection]:
            candidates = [
                item
                for source in wanted
                for item in self._master_by_source.get(source, [])
            ]
            filtered = [
                item
                for item in candidates
                if item.acquired_at >= threshold
                and CONFIDENCE_RANK[item.confidence] >= minimum
                and _in_bbox(item.latitude, item.longitude, west, south, east, north)
            ]
            return deduplicate_detections(filtered)

        normalized = await asyncio.to_thread(build)
        age_seconds = (self.now() - self._master_updated_at).total_seconds() if self._master_updated_at else None
        return FireResponse(
            detections=normalized,
            meta=FireMeta(
                sources=sorted(wanted),
                requested_hours=query.hours,
                fetched_at=self._master_updated_at or self.now(),
                latest_acquisition=normalized[0].acquired_at if normalized else None,
                count=len(normalized),
                cache="hit",
                # Flag as stale once the background refresh has clearly fallen
                # behind (3x its own interval), rather than on every request.
                stale=age_seconds is not None and age_seconds > self.settings.firms_refresh_interval_seconds * 3,
            ),
        )

    async def _fetch_live(self, query: FireQuery) -> FireResponse:
        """The original on-demand path: used only before the first background
        refresh_master() completes (e.g. right after a cold start)."""
        cache_key = self._data_cache_key(query)
        if cached := self.data_cache.get_fresh(cache_key):
            result = cached.model_copy(deep=True)
            result.meta.cache = "hit"
            result.meta.stale = False
            return result

        try:
            # FIRMS' `day_range` counts whole calendar days back from "today"
            # in its own processing pipeline, not a rolling N*24h window: the
            # current day's bucket is often still empty right after the UTC
            # day boundary, before that day's satellite passes are processed.
            # Requesting one extra day of raw data absorbs that gap; the exact
            # `hours` cutoff below still trims the result to the real window.
            day_range = query.hours // 24 + 1
            requests = [
                (source, bounds)
                for source in sorted(set(query.sources))
                for bounds in split_bounds(query.west, query.south, query.east, query.north)
            ]

            async def fetch_one(client: httpx.AsyncClient, source: FirmsSource, bounds: tuple[float, float, float, float]) -> list[FireDetection]:
                area = ",".join(f"{value:g}" for value in bounds)
                response = await client.get(
                    f"{self.settings.firms_base_url}/api/area/csv/"
                    f"{self.settings.nasa_firms_map_key}/{source}/{area}/{day_range}"
                )
                response.raise_for_status()
                # A whole-world, multi-day CSV can be tens of thousands of
                # rows; parsing it is CPU-bound pure Python, so running it
                # inline would block the event loop (and every other request
                # this process is serving) for the whole parse. Farming it
                # out to a thread keeps the server responsive to everything
                # else while the big requests grind through their own CSV.
                return await asyncio.to_thread(parse_firms_csv, response.text, source)

            # The bare-metal deploy showed this endpoint as the slow one: with
            # 2 sources x up to 2 bounds, this loop used to make up to 4 NASA
            # FIRMS requests back-to-back, each one a multi-second round trip.
            # Firing them concurrently turns "4 sequential requests" into
            # "as slow as the single slowest one".
            async with httpx.AsyncClient(timeout=20.0) as client:
                results = await asyncio.gather(*(fetch_one(client, source, bounds) for source, bounds in requests))
            detections: list[FireDetection] = [item for batch in results for item in batch]
            threshold = self.now() - timedelta(hours=query.hours)
            minimum = CONFIDENCE_RANK[query.min_confidence]

            def filter_and_dedupe() -> list[FireDetection]:
                filtered = [
                    item
                    for item in detections
                    if item.acquired_at >= threshold and CONFIDENCE_RANK[item.confidence] >= minimum
                ]
                return deduplicate_detections(filtered)

            normalized = await asyncio.to_thread(filter_and_dedupe)
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
