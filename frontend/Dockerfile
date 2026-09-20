# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Reverse-proxy target for /api, resolved at container start via envsubst
# (nginx:alpine runs docker-entrypoint.d scripts that expand *.template files
# in /etc/nginx/templates into /etc/nginx/conf.d automatically).
ENV API_PROXY_PASS=http://backend:8000

EXPOSE 80
