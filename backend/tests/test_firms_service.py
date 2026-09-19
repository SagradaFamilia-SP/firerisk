from datetime import UTC, datetime

import httpx
import pytest
import respx
from httpx import Response

from app.core.config import Settings
from app.schemas.fires import FireQuery
from app.services.cache import TTLCache
from app.services.firms import (
    FirmsService,
    deduplicate_detections,
    parse_firms_csv,
    split_bounds,
)


CSV_HEADER = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,"
    "satellite,instrument,confidence,version,bright_ti5,frp,daynight\n"
)
NOAA20_CSV = CSV_HEADER + "39.681,-6.347,341.2,0.42,0.38,2026-09-19,1442,N20,VIIRS,n,2.0NRT,295.1,18.7,D\n"
NOAA21_CSV = CSV_HEADER + "40.100,-5.900,356.4,0.51,0.41,2026-09-19,1435,N21,VIIRS,h,2.0NRT,301.4,32.2,N\n"
INVALID_ROWS_CSV = CSV_HEADER + "95,-6.3,341,0.4,0.4,2026-09-19,1442,N21,VIIRS,h,2.0NRT,295,10,D\n-2,181,341,0.4,0.4,bad,9999,N21,VIIRS,l,2.0NRT,295,10,D\n"


def test_parse_firms_csv_normalizes_viirs_row() -> None:
    result = parse_firms_csv(NOAA20_CSV, source="VIIRS_NOAA20_NRT")
    assert len(result) == 1
    assert result[0].latitude == 39.681
    assert result[0].longitude == -6.347
    assert result[0].acquired_at.isoformat() == "2026-09-19T14:42:00+00:00"
    assert result[0].confidence == "nominal"
    assert result[0].frp == 18.7
    assert result[0].daynight == "day"


def test_parser_discards_invalid_coordinates_and_time() -> None:
    assert parse_firms_csv(INVALID_ROWS_CSV, source="VIIRS_NOAA21_NRT") == []


def test_deduplicate_detections_keeps_newest_first() -> None:
    older = parse_firms_csv(NOAA20_CSV, source="VIIRS_NOAA20_NRT")[0]
    newer = parse_firms_csv(NOAA21_CSV, source="VIIRS_NOAA21_NRT")[0]
    result = deduplicate_detections([older, newer, older])
    assert [item.satellite for item in result] == ["N20", "N21"]
    assert len(result) == 2


def test_split_bounds_keeps_normal_box() -> None:
    assert split_bounds(-10, 35, 5, 45) == [(-10, 35, 5, 45)]


def test_split_bounds_handles_antimeridian() -> None:
    assert split_bounds(170, -20, -170, 10) == [
        (170, -20, 180, 10),
        (-180, -20, -170, 10),
    ]


@respx.mock
@pytest.mark.asyncio
async def test_repeated_query_uses_fresh_cache() -> None:
    route = respx.get(url__regex=r"https://firms\.example/api/area/csv/.+").mock(
        return_value=Response(200, text=NOAA20_CSV)
    )
    service = _service()
    query = FireQuery(west=-10, south=35, east=5, north=45, sources=["VIIRS_NOAA20_NRT"])
    first = await service.fetch_detections(query)
    second = await service.fetch_detections(query)
    assert first.meta.cache == "miss"
    assert second.meta.cache == "hit"
    assert route.call_count == 1


@respx.mock
@pytest.mark.asyncio
async def test_expired_query_uses_real_stale_data_on_timeout() -> None:
    moment = [0.0]
    cache: TTLCache = TTLCache(ttl_seconds=300, clock=lambda: moment[0])
    route = respx.get(url__regex=r"https://firms\.example/api/area/csv/.+").mock(
        side_effect=[Response(200, text=NOAA20_CSV), httpx.ReadTimeout("late")]
    )
    service = _service(cache=cache)
    query = FireQuery(west=-10, south=35, east=5, north=45, sources=["VIIRS_NOAA20_NRT"])
    fresh = await service.fetch_detections(query)
    moment[0] = 301
    stale = await service.fetch_detections(query)
    assert fresh.meta.stale is False
    assert stale.meta.stale is True
    assert stale.detections[0].id == fresh.detections[0].id
    assert route.call_count == 2


def _service(cache: TTLCache | None = None) -> FirmsService:
    settings = Settings(
        nasa_firms_map_key="test-secret",
        firms_base_url="https://firms.example",
    )
    return FirmsService(
        settings=settings,
        data_cache=cache,
        now=lambda: datetime(2026, 9, 19, 15, 0, tzinfo=UTC),
    )
