# PYROS — Wildfire Intelligence

Monorepo de la demo operativa de riesgo de incendios de PYROS. Incluye un backend FastAPI para datos reales de incendios, simulación, meteorología y planes de actuación, y un dashboard React centrado en mapa para explorar el impacto sobre activos críticos.

## Estructura

```text
.
├── backend/     API FastAPI, dominio y pruebas
├── frontend/    React + TypeScript + Vite
├── docs/        Especificación y plan técnico
└── Makefile     Comandos de desarrollo
```

`fire-risk-demo/` conserva temporalmente el prototipo previo como referencia local. Las aplicaciones canónicas son `backend/` y `frontend/`.

## Requisitos

- Python 3.11 o superior
- Node.js 20 o superior
- npm 10 o superior

## Instalación

Desde la raíz del repositorio:

```bash
make install
```

También puedes instalar cada aplicación por separado:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e "backend[dev]"

cd frontend
npm install
```

## Desarrollo

Levanta el backend en una terminal:

```bash
make backend
```

Levanta el frontend en otra:

```bash
make frontend
```

Abre `http://127.0.0.1:5173`. Vite redirige automáticamente las peticiones `/api` a FastAPI.

- Dashboard: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000/api/health`
- Documentación OpenAPI: `http://127.0.0.1:8000/docs`

## Configuración

Copia el ejemplo del backend si quieres cambiar el modelo local:

```bash
cp backend/.env.example backend/.env
```

Variables disponibles:

- `MODEL_BASE_URL`: endpoint OpenAI-compatible. En local `http://localhost:30000/v1`; en Docker usa `http://host.docker.internal:<puerto>/v1` para llegar al LLM que corre en el host (ver "Despliegue con Docker").
- `MODEL_ID`: identificador del modelo servido.
- `FRONTEND_ORIGINS`: orígenes CORS separados por comas.
- `NASA_FIRMS_MAP_KEY`: clave privada de NASA FIRMS. Nunca se envía al navegador.
- `FIRMS_BASE_URL`: origen oficial de FIRMS; normalmente no es necesario cambiarlo.
- `FIRMS_DATA_CACHE_TTL_SECONDS`: caché de observaciones por viewport, 300 s por defecto.
- `FIRMS_WMS_CACHE_TTL_SECONDS`: caché de teselas WMS, 900 s por defecto.
- `SPEECH_API_KEY`: clave de la API de voz de [SLNG](https://slng.ai) (`/v1/bridges/unmute/stt/{modelo}`). Necesaria para el botón de micrófono del chat. Nunca se envía al navegador.
- `SPEECH_BASE_URL`: origen de la API de voz. Por defecto `https://api.slng.ai`.
- `SPEECH_MODEL`: modelo de transcripción (proveedor/modelo). Por defecto `deepgram/nova:3`.
- `SPEECH_LANGUAGE`: idioma de reconocimiento. Por defecto `es`.

## Incendios reales

- La vista global consume las capas WMS oficiales de NASA FIRMS para VIIRS NOAA-20 y NOAA-21 de las últimas 24 horas.
- A partir de zoom 5, `/api/fires` obtiene las observaciones estructuradas del área visible para mostrar hora de adquisición, confianza y potencia radiativa (FRP).
- Las consultas de área se cachean por viewport y se cancelan al seguir moviendo el mapa. Si FIRMS falla, sólo se reutiliza una respuesta real previamente cacheada; nunca se generan focos ficticios.
- Los botones de globo y diana cambian entre la vista mundial y la instalación de Talaván.

La clave entregada por NASA debe guardarse únicamente en `backend/.env`, que está ignorado por Git. Puedes comprobar los endpoints en `http://127.0.0.1:8000/docs`.

Si el modelo no responde o devuelve contenido inválido, `/api/agent-plan` entrega automáticamente un plan determinista de contingencia.

## Despliegue con Docker

Cada app tiene su propio `Dockerfile` (ver [backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md) para el detalle), y hay un `docker-compose.yml` en la raíz para levantar ambas juntas:

```bash
cp backend/.env.example backend/.env   # rellena las claves de producción
docker compose up --build -d
```

- Frontend (nginx) queda en `http://<servidor>:80`, proxeando `/api/*` al backend.
- Backend (FastAPI/uvicorn) queda en `http://<servidor>:8000`.
- `backend/.env` se monta vía `env_file`; nunca se hornea en la imagen.
- Los pesos de YOLO (`models/best.pt`) y la clave privada de Vonage (`private.key`) viven en la **raíz del repo** y se montan como volúmenes de solo lectura — no forman parte de la imagen. Ver [backend/README.md](backend/README.md) para el detalle de rutas.
- El LLM (`MODEL_BASE_URL`) corre en el host, no en compose. Dentro del contenedor `localhost` es el propio contenedor, así que `backend/.env` debe apuntar a `http://host.docker.internal:3000/v1` (puerto donde esté expuesto el modelo). `docker-compose.yml` ya resuelve ese hostname en Linux vía `extra_hosts`; en macOS/Windows con Docker Desktop funciona sin configuración adicional.
- Antes de exponer el servidor a Internet, pon un reverse proxy con TLS (Caddy/Traefik/nginx) delante de los puertos 80/8000, y actualiza `FRONTEND_ORIGINS` en `backend/.env` con el dominio final.

Para reconstruir tras un `git pull`:

```bash
docker compose up --build -d
```

## Despliegue en servidor sin Docker (pyros.strategicplatform.com)

Configuración lista en `deploy/`: [`deploy/pyros-backend.service`](deploy/pyros-backend.service) (systemd) y [`deploy/pyros.strategicplatform.com.conf`](deploy/pyros.strategicplatform.com.conf) (Apache vhost + SSL con el wildcard de `strategicplatform.com`).

En el servidor:

```bash
sudo mkdir -p /var/www/pyros && sudo chown $USER:$USER /var/www/pyros
git clone <repo> /var/www/pyros
cd /var/www/pyros

# Backend
python3 -m venv backend/.venv
backend/.venv/bin/pip install -e "backend[dev]"
cp backend/.env.example backend/.env   # rellena claves reales + FRONTEND_ORIGINS con el dominio final
# coloca los pesos de YOLO en ./models/best.pt y la clave de Vonage en ./private.key (raíz del repo)

# Frontend (build estático servido por Apache)
cd frontend && npm install && npm run build && cd ..
```

Backend como servicio systemd:

```bash
sudo cp deploy/pyros-backend.service /etc/systemd/system/
sudo useradd -r -s /usr/sbin/nologin pyros 2>/dev/null || true
sudo chown -R pyros:pyros /var/www/pyros
sudo systemctl daemon-reload
sudo systemctl enable --now pyros-backend
sudo systemctl status pyros-backend
```

Apache + SSL (usa el wildcard cert existente, ajusta las rutas del `.conf` si difieren):

```bash
sudo a2enmod ssl proxy proxy_http headers rewrite
sudo cp deploy/pyros.strategicplatform.com.conf /etc/apache2/sites-available/
sudo a2ensite pyros.strategicplatform.com
sudo apachectl configtest && sudo systemctl reload apache2
```

El vhost redirige HTTP→HTTPS, sirve `frontend/dist` como SPA y proxea `/api/*` a `127.0.0.1:8000` (el backend systemd). Actualiza `SSLCertificateFile`/`SSLCertificateKeyFile` en el `.conf` a la ruta real donde esté el wildcard de `strategicplatform.com` si no coincide con la del archivo.

Para desplegar cambios tras un `git pull`:

```bash
cd /var/www/pyros && git pull
backend/.venv/bin/pip install -e "backend[dev]"
sudo systemctl restart pyros-backend
cd frontend && npm install && npm run build
```

## Calidad

```bash
make test    # pytest + Vitest
make lint    # TypeScript + ESLint
make build   # build de producción Vite
make check   # todas las comprobaciones
```

El mapa utiliza NASA FIRMS, teselas remotas de Esri y OpenStreetMap. La meteorología real se consulta a Open-Meteo, por lo que estas funciones requieren conexión a Internet.


