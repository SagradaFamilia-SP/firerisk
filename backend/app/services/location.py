from collections.abc import Mapping

import httpx

from app.core.config import Settings, get_settings
from app.schemas.location import ReverseLocationResponse
from app.services.cache import TTLCache


class LocationUnavailableError(RuntimeError):
    pass


def _first(address: Mapping[str, object], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


class LocationService:
    def __init__(
        self,
        settings: Settings,
        cache: TTLCache[ReverseLocationResponse] | None = None,
    ) -> None:
        self.settings = settings
        self.cache = cache or TTLCache(settings.nominatim_cache_ttl_seconds)

    async def reverse(self, lat: float, lon: float) -> ReverseLocationResponse:
        coordinates = f"{lat:.4f}, {lon:.4f}"
        key = coordinates
        if cached := self.cache.get_fresh(key):
            return cached

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    f"{self.settings.nominatim_base_url}/reverse",
                    params={
                        "format": "jsonv2",
                        "lat": f"{lat:.6f}",
                        "lon": f"{lon:.6f}",
                        "zoom": "10",
                        "addressdetails": "1",
                        "accept-language": "es,en",
                    },
                    headers={"User-Agent": self.settings.nominatim_user_agent},
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            if stale := self.cache.get_any(key):
                return stale
            raise LocationUnavailableError("Geocodificación no disponible") from exc

        address = payload.get("address") if isinstance(payload, dict) else None
        if not isinstance(address, dict):
            raise LocationUnavailableError("Geocodificación no disponible")

        place = _first(address, ("city", "town", "village", "hamlet", "suburb", "county", "state"))
        municipality = _first(address, ("municipality", "county", "state_district", "state"))
        country = _first(address, ("country",))
        label_parts = [part for part in (place, municipality) if part]
        label = ", ".join(dict.fromkeys(label_parts)) or payload.get("display_name") or "Ubicación desconocida"
        result = ReverseLocationResponse(
            label=str(label),
            place=place or str(label),
            municipality=municipality,
            country=country,
            coordinates=coordinates,
        )
        self.cache.set(key, result)
        return result


_service: LocationService | None = None


def get_location_service() -> LocationService:
    global _service
    if _service is None:
        _service = LocationService(get_settings())
    return _service
