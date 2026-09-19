from app.services.chat import detect_hours, detect_region


def test_detect_region_matches_spanish_and_english_aliases() -> None:
    assert detect_region("¿Qué incendios tengo en España?") == "espana"
    assert detect_region("fires in Spain right now") == "espana"
    assert detect_region("incendios activos en Portugal") == "portugal"
    assert detect_region("wildfires in Greece") == "grecia"


def test_detect_region_defaults_to_spain_when_unmatched() -> None:
    assert detect_region("hay incendios activos ahora?") == "espana"


def test_detect_hours_reads_explicit_window() -> None:
    assert detect_hours("incendios en las últimas 72 horas") == 72
    assert detect_hours("incendios en los últimos 2 días") == 48
    assert detect_hours("qué incendios tengo en España") == 24
