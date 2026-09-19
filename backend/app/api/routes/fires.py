from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import ValidationError

from app.schemas.fires import FireQuery, FireResponse, WmsQuery
from app.services.firms import (
    FirmsNotConfiguredError,
    FirmsService,
    FirmsUnavailableError,
    get_firms_service,
)

router = APIRouter(tags=["fires"])
Service = Annotated[FirmsService, Depends(get_firms_service)]
SOURCE_ALIASES = {
    "NOAA20": "VIIRS_NOAA20_NRT",
    "NOAA21": "VIIRS_NOAA21_NRT",
    "VIIRS_NOAA20_NRT": "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT": "VIIRS_NOAA21_NRT",
}


def _validation_error(exc: ValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail=exc.errors(include_context=False))


@router.get("/fires", response_model=FireResponse)
async def fires(
    service: Service,
    west: Annotated[float, Query(ge=-180, le=180)],
    south: Annotated[float, Query(ge=-90, le=90)],
    east: Annotated[float, Query(ge=-180, le=180)],
    north: Annotated[float, Query(ge=-90, le=90)],
    hours: Annotated[int, Query()] = 24,
    sources: Annotated[str, Query()] = "VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT",
    min_confidence: Annotated[str, Query()] = "low",
) -> FireResponse:
    try:
        query = FireQuery(
            west=west,
            south=south,
            east=east,
            north=north,
            hours=hours,
            sources=[SOURCE_ALIASES.get(item.strip(), item.strip()) for item in sources.split(",") if item.strip()],
            min_confidence=min_confidence,
        )
        return await service.fetch_detections(query)
    except ValidationError as exc:
        raise _validation_error(exc) from exc
    except FirmsNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except FirmsUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/fires/wms")
async def fires_wms(
    service: Service,
    service_name: Annotated[str, Query(alias="service")] = "WMS",
    request: Annotated[str, Query()] = "GetMap",
    version: Annotated[str, Query()] = "1.1.1",
    layers: Annotated[str, Query()] = "",
    styles: Annotated[str, Query()] = "",
    format_name: Annotated[str, Query(alias="format")] = "image/png",
    transparent: Annotated[str, Query()] = "true",
    width: Annotated[int, Query()] = 256,
    height: Annotated[int, Query()] = 256,
    bbox: Annotated[str, Query()] = "",
    srs: Annotated[str | None, Query()] = None,
    crs: Annotated[str | None, Query()] = None,
) -> Response:
    try:
        query = WmsQuery(
            service=service_name,
            request=request,
            version=version,
            layers=layers,
            styles=styles,
            format=format_name,
            transparent=transparent,
            width=width,
            height=height,
            bbox=bbox,
            srs=srs,
            crs=crs,
        )
        content, content_type, cached = await service.fetch_wms(query)
    except ValidationError as exc:
        raise _validation_error(exc) from exc
    except FirmsNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except FirmsUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=900, stale-if-error=900",
            "X-FIRMS-Cache": "hit" if cached else "miss",
        },
    )
