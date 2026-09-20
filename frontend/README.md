# PYROS frontend

Dashboard React + TypeScript + Vite: mapa de incendios, simulación de propagación, chat asistente y cámaras.

## Desarrollo local

```bash
npm install
npm run dev
```

Sirve en `http://127.0.0.1:5173` y redirige `/api` al backend en `http://127.0.0.1:8000` (ver `vite.config.ts`).

## Build de producción

```bash
npm run build
```

Genera `dist/`, servible por cualquier servidor de estáticos. La app llama a la API en `/api` (relativo) salvo que se defina `VITE_API_BASE_URL` en build time.

## Docker

```bash
docker build -t pyros-frontend .
docker run --rm -p 80:80 \
  -e API_PROXY_PASS=http://backend:8000 \
  pyros-frontend
```

La imagen es un build multi-stage: compila con Node y sirve los estáticos con nginx. `nginx.conf` hace de proxy inverso de `/api/*` hacia `API_PROXY_PASS` (por defecto `http://backend:8000`, el nombre del servicio en `docker-compose.yml`).

Para levantar backend + frontend juntos, usa el `docker-compose.yml` de la raíz del repo.
