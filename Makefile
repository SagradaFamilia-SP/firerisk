.PHONY: install backend frontend test lint build check

install:
	python3 -m venv backend/.venv
	backend/.venv/bin/python -m pip install -e "backend[dev]"
	cd frontend && npm install

backend:
	cd backend && .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

frontend:
	cd frontend && npm run dev -- --host 127.0.0.1

test:
	cd backend && .venv/bin/python -m pytest -q
	cd frontend && npm test -- --run

lint:
	cd frontend && npm run typecheck
	cd frontend && npm run lint

build:
	cd frontend && npm run build

check: test lint build
