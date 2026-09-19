from typing import TypedDict


class AssetDefinition(TypedDict):
    id: str
    name: str
    x: float
    y: float
    lat: float
    lng: float
    value_eur: int
    people: int
    criticality: float
    icon: str


ASSETS: tuple[AssetDefinition, ...] = (
    {
        "id": "solar",
        "name": "Planta Solar Talaván Norte",
        "x": 68,
        "y": 46,
        "lat": 39.7178,
        "lng": -6.2631,
        "value_eur": 18_500_000,
        "people": 9,
        "criticality": 1.0,
        "icon": "solar",
    },
    {
        "id": "substation",
        "name": "Subestación 220 kV",
        "x": 76,
        "y": 52,
        "lat": 39.7088,
        "lng": -6.2785,
        "value_eur": 4_200_000,
        "people": 2,
        "criticality": 1.0,
        "icon": "zap",
    },
    {
        "id": "warehouse",
        "name": "Almacén técnico",
        "x": 61,
        "y": 60,
        "lat": 39.7295,
        "lng": -6.286,
        "value_eur": 780_000,
        "people": 4,
        "criticality": 0.7,
        "icon": "warehouse",
    },
    {
        "id": "tower",
        "name": "Torre de telecomunicaciones",
        "x": 83,
        "y": 35,
        "lat": 39.704,
        "lng": -6.235,
        "value_eur": 350_000,
        "people": 0,
        "criticality": 0.8,
        "icon": "radio-tower",
    },
)

