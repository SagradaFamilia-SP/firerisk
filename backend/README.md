# PYROS backend

API FastAPI: incendios NASA FIRMS, geocoding inverso, simulación de propagación, chat con LLM, transcripción de voz y el pipeline de cámara (Vonage + YOLO).

## Desarrollo local

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
cp .env.example .env   # rellena las claves necesarias
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Variables de entorno: ver `.env.example` y la sección "Configuración" del [README raíz](../README.md).

## Docker

```bash
docker build -t pyros-backend .
docker run --rm -p 8000:8000 \
  --env-file .env \
  -v "$(pwd)/model:/app/model:ro" \
  pyros-backend
```

- El contenedor no incluye los pesos de YOLO (`model/best.pt`): móntalos como volumen o define `YOLO_MODEL_PATH` apuntando a otra ruta montada.
- `.env` nunca se copia a la imagen (ver `.dockerignore`); pásalo con `--env-file` o `env_file` en compose.
- La imagen instala `libgdal32`, `libgeos-c1v5`, `libgl1` y `libglib2.0-0`, necesarias para `rasterio` (WMS/mapas) y `opencv`/`ultralytics` (detección por cámara).

Para levantar backend + frontend juntos, usa el `docker-compose.yml` de la raíz del repo.
