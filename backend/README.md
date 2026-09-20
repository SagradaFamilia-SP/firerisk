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
  -v "$(pwd)/../models:/app/models:ro" \
  -v "$(pwd)/../private.key:/app/private.key:ro" \
  pyros-backend
```

- El contenedor no incluye los pesos de YOLO ni la clave de Vonage: se montan como volúmenes, resueltos contra el `.env` así:
  - `YOLO_MODEL_PATH=./models/best.pt` → monta `models/best.pt` (en la **raíz del repo**, no dentro de `backend/`) en `/app/models/best.pt`.
  - `VONAGE_PRIVATE_KEY_PATH=./private.key` → monta `private.key` (también en la raíz del repo) en `/app/private.key`.
  - Ambas rutas son relativas al `WORKDIR` del contenedor (`/app`), no a dónde vive el archivo en el host.
  - `private.key` debe existir como **archivo** antes de `docker compose up`; si no existe, Docker crea una carpeta vacía en su lugar y Vonage fallará al leer la clave.
- `.env` nunca se copia a la imagen (ver `.dockerignore`); pásalo con `--env-file` o `env_file` en compose.
- La imagen instala `libgl1` y `libglib2.0-0` (runtime de `opencv`/`ultralytics` para la detección por cámara); `rasterio` trae su propio GDAL en la wheel, sin dependencias de sistema.

Para levantar backend + frontend juntos, usa el `docker-compose.yml` de la raíz del repo — ya monta `./models` y `./private.key` desde ahí.
