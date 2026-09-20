FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# rasterio ships its own bundled GDAL in the manylinux wheel, so no system
# libgdal is needed. libgl1/libglib2.0-0 are runtime deps for opencv (video/
# YOLO pipeline); build-essential covers any package without a prebuilt wheel.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app

RUN pip install -e .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
