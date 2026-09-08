# services/ocr

Microservicio Python (FastAPI) de OCR de boletas. Fuera del workspace pnpm (**uv**).

## Local

```bash
cd services/ocr
uv sync
uv run uvicorn app.main:app --reload --port 8001
```

> `paddleocr` + `paddlepaddle` son pesados (~1 GB). Para iterar rápido en local
> puedes empezar solo con Tesseract (`tesseract-ocr-spa`) tras la interfaz
> `OcrProvider` y añadir Paddle cuando toque.

## Diseño

- `app/providers/base.py` — interfaz `OcrProvider` (adaptadores intercambiables).
- Primario **PaddleOCR** (self-host), fallback **Tesseract**.
- El provider efectivo llega en el request (lo decide la API core según el plan,
  `AppSetting ocr.provider_by_plan`).
- Este servicio SOLO hace OCR (texto + layout). El parseo de boleta y el match
  contra `CanonicalInput` se hacen en el worker de `api`.

## Railway

Servicio con **Root Directory = `services/ocr`**, builder Dockerfile, sin dominio
público. Healthcheck 60s (carga de modelos al arrancar).
