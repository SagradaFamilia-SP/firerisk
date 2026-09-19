from pydantic import BaseModel


class ReverseLocationResponse(BaseModel):
    label: str
    place: str
    municipality: str | None = None
    country: str | None = None
    coordinates: str
    attribution: str = "© OpenStreetMap contributors"
