# IGNIS Monorepo Redesign

**Date:** 2026-09-19  
**Status:** Approved design, pending implementation plan

## Purpose

Turn the existing IGNIS wildfire-risk prototype into a clean hackathon foundation that can be extended throughout the day without carrying forward the current coupling between FastAPI, HTML, CSS, and browser JavaScript.

The result must preserve the useful demo flows while improving the visual hierarchy, development experience, reliability, and separation of responsibilities. It is a hackathon-ready foundation, not a production platform: speed of iteration and clarity take priority over infrastructure that is not yet needed.

## Current State

The current prototype lives under `fire-risk-demo/` and consists of:

- One FastAPI module containing configuration, API routes, domain calculations, external HTTP calls, fallback behavior, and static-file serving.
- One large HTML file containing all markup, styling, state, map rendering, API calls, and interactions.
- A Python requirements file and a short local-run README.
- No automated tests or typed contract between the browser and API.

The migration will use this prototype as a functional reference. Its layout and implementation are not constraints on the redesign.

## Scope

### Included

- A root monorepo containing independent `frontend/` and `backend/` applications.
- A React, TypeScript, and Vite frontend.
- A modular Python and FastAPI backend.
- A redesigned responsive operational dashboard.
- A React Leaflet map retaining the existing map layers and interactions.
- Preservation of the existing health, weather, simulation, and operational-plan capabilities.
- Typed frontend API contracts and Pydantic backend request and response schemas.
- Environment-based configuration with safe example values.
- Root-level commands and documentation for installing, running, testing, linting, and building the applications.
- Focused backend tests and frontend type, lint, and production-build verification.

### Excluded

- Authentication and authorization.
- A database, persistence, and migrations.
- Docker or deployment infrastructure.
- Background jobs, queues, telemetry platforms, and production observability.
- Replacement of the existing OpenAI-compatible model endpoint.
- Real emergency-system integrations beyond the existing Open-Meteo request and demo data.

## Repository Structure

```text
firerisk/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   ├── .env.example
│   └── pyproject.toml
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── .gitignore
├── Makefile
└── README.md
```

Directories may gain small index or configuration files during implementation, but the responsibility boundaries above must remain recognizable.

## Backend Design

### Application Boundary

FastAPI exposes JSON only and does not serve the frontend. During development, Vite proxies `/api` to FastAPI. This keeps local requests same-origin while allowing the applications to be deployed independently later.

### Responsibilities

- `app/main.py`: application construction, metadata, middleware, and router registration.
- `app/core/`: settings loaded from environment and shared application configuration.
- `app/models/`: stable domain data such as demo assets.
- `app/schemas/`: Pydantic request and response contracts.
- `app/services/`: risk calculation, propagation, external weather access, and operational-plan generation.
- `app/api/routes/`: HTTP translation only; routes validate input, call a service, and return a typed response.

External HTTP clients must have explicit timeouts. Expected upstream failures are converted into stable API behavior: weather failures return a `502` response, while model failures return the deterministic operational plan with diagnostic mode information.

### API Compatibility

The following routes remain available:

- `GET /api/health`: reports API health and availability of the configured model endpoint.
- `GET /api/weather?lat=<number>&lon=<number>`: returns normalized current weather from Open-Meteo.
- `POST /api/simulate`: returns cells, propagation geometry, affected assets, metrics, and source status for a validated scenario.
- `POST /api/agent-plan`: returns a model-generated operational plan or the deterministic fallback.

The response bodies become explicit schemas. Existing field names used by the prototype are preserved where practical to reduce migration risk. Input validation must reject out-of-range scenario values with FastAPI's standard `422` response.

### Configuration

Backend settings include:

- `MODEL_BASE_URL`, defaulting to `http://localhost:30000/v1`.
- `MODEL_ID`, defaulting to `/workspace/models/qwen3.6-35b-a3b`.
- `FRONTEND_ORIGINS`, defaulting to the local Vite origin.

Secrets and local overrides are excluded from Git. A committed `.env.example` documents every supported value.

## Frontend Design

### Technology and State

The frontend uses React 19, TypeScript, Vite, React Leaflet, Leaflet, and Lucide React. It uses React hooks and local application state; a global state framework is intentionally excluded.

One dashboard hook coordinates scenario state, simulation refresh, real-weather loading, plan generation, loading flags, and recoverable errors. Presentational components receive typed props. Network calls live in `services/` and return typed domain values rather than raw `Response` objects.

### Visual Direction

IGNIS becomes a focused operational command surface:

- A charcoal and blue-grey foundation with warm fire accents.
- Red reserved for genuinely critical states.
- Strong typography and spacing hierarchy instead of dense borders around every element.
- A map-dominant central workspace.
- Consistent Lucide icons instead of emoji as primary interface iconography.
- Visible focus styles, meaningful button labels, and sufficient contrast.
- Loading, empty, offline, fallback, and error states designed as part of the interface.

The existing dark emergency-intelligence identity remains recognizable, but the redesign is free to change layout, sizing, copy hierarchy, and component styling.

### Layout

On wide screens the application uses three operational zones:

```text
TopBar
├── Context sidebar
├── Map workspace
└── Intelligence panel
```

- The context sidebar contains the monitored site, overall risk, layer controls, and ranked assets.
- The map workspace contains the Leaflet map, scenario controls, base-map switch, forecast timeline, and risk legend.
- The intelligence panel contains weather metrics, incident alerting, estimated impact, data-source status, plan generation, and the operational plan.

At tablet widths, secondary panels become compact or collapsible while the map remains usable. At mobile widths, content becomes a vertical dashboard with an intentionally sized map rather than hiding essential controls.

### Component Boundaries

```text
AppShell
├── TopBar
├── Sidebar
│   ├── SiteSummary
│   ├── RiskOverview
│   ├── LayerControls
│   └── AssetList
├── MapWorkspace
│   ├── FireRiskMap
│   ├── MapToolbar
│   ├── ForecastTimeline
│   └── RiskLegend
└── IntelligencePanel
    ├── WeatherMetrics
    ├── IncidentAlert
    ├── ImpactSummary
    ├── DataSourceStatus
    └── OperationsPlan
```

Large map-rendering details may be split into focused helpers or overlay components. No component should combine unrelated network, domain, and presentation responsibilities.

## User Flows

### Initial Load

1. The frontend renders immediately with the built-in Talaván demo scenario.
2. It checks backend and model status without blocking the rest of the dashboard.
3. It sends the current scenario to `/api/simulate` and uses the response to populate risk cells, affected assets, propagation, and impact metrics.
4. If simulation fails, the dashboard keeps the last usable view and presents a retry action.

### Scenario Exploration

The user can adjust the forecast horizon, play the timeline, activate the critical scenario, toggle map layers, switch map type, center the monitored site, and select an asset. Scenario changes request a new simulation without recreating the entire map.

### Real Weather

The user requests current weather for the monitored coordinates. On success, temperature, humidity, wind speed, and wind direction update and trigger a simulation. On failure, the previous scenario remains intact and a non-blocking error message explains the problem.

### Operational Plan

The user requests a plan from the current incident and affected assets. The UI disables duplicate submissions and shows progress. The returned plan clearly labels whether it came from the configured model or the deterministic fallback. Malformed or unavailable upstream model output must never leave the dashboard stuck in a loading state.

## Error Handling

- Backend validation errors use standard structured FastAPI responses.
- Weather upstream errors produce `502` with a concise user-safe detail.
- Model errors are absorbed by the fallback-plan service and surfaced through the plan's mode and optional diagnostic field.
- Frontend service failures are normalized into readable messages.
- A global error boundary protects the application shell from unexpected render errors.
- Map library or tile failures show a local map notice; they do not replace the whole dashboard.
- Buttons always restore their enabled state after success or failure.

## Testing and Quality Gates

Backend tests cover:

- Risk score bounds and representative scenarios.
- Propagation behavior with active and inactive hotspots.
- Simulation response shape and asset ordering.
- Request validation for invalid environmental inputs.
- Weather success and upstream failure through mocked HTTP calls.
- Operational-plan model success, malformed output, and deterministic fallback.
- Health behavior with an online and offline model endpoint.

Frontend verification covers:

- TypeScript compilation.
- ESLint.
- Production Vite build.
- Focused component or hook tests for critical asynchronous state where setup cost remains proportionate to hackathon needs.

The repository is complete only when backend tests pass, frontend checks pass, both development servers start, and the redesigned dashboard can load through the frontend URL while using the backend API.

## Developer Experience

The root README provides prerequisites, first-time installation, environment setup, development commands, tests, and build commands. A root `Makefile` offers memorable commands without hiding the underlying package-manager and Python commands.

Expected local ports:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Backend API documentation: `http://localhost:8000/docs`

The previous `fire-risk-demo/` prototype is retained until the new applications pass their verification. It is removed as part of the final migration so there is one canonical implementation, while its history remains recoverable through Git once committed.

## Acceptance Criteria

- The repository root clearly exposes `frontend/` and `backend/` as independent applications.
- A new contributor can install and run both applications by following only the root README.
- The React application reproduces all valuable current interactions with the approved redesigned interface.
- The frontend obtains simulation results from FastAPI rather than duplicating risk logic in the browser.
- All four existing API capabilities remain available with typed contracts.
- The application remains usable when Open-Meteo or the configured model is offline.
- Responsive behavior preserves core controls and information on desktop, tablet, and mobile.
- Backend tests, frontend type checking, frontend linting, and frontend production build all pass.
- No local virtual environments, dependency directories, caches, secrets, or generated build outputs are committed.
