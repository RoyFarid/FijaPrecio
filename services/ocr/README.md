# services/ocr

Microservicio Python (FastAPI) de OCR de boletas. `uv` (no está en el workspace pnpm).

## Local

```bash
cd services/ocr
uv sync
# binario de tesseract (Docker ya lo trae):  choco install tesseract  /  apt install tesseract-ocr tesseract-ocr-spa
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8001

uv run pytest        # preprocesado + carga de imagen (no requiere binario)
uv run ruff check .
uv run mypy app
```

## Cómo funciona

```
POST /internal/ocr  { imageBase64 | imageUrl, provider? }   (X-Internal-Token)
  → load_image_bytes  (base64 inline o descarga, con tope de tamaño)
  → preprocess         (OpenCV: grises → downscale → deskew → binariza)
  → provider.recognize (TesseractProvider por defecto)
  ← { rawText, lines: [{ text, confidence, bbox }], provider }
```

- **`OcrProvider`** (Protocol): `TesseractProvider` (self-host, funciona hoy),
  `PaddleProvider` (extra `paddle`, ~2 GB — no se instala por defecto), espacio
  para Textract / Vision / Gemini. La selección por plan la decide la API core
  (`AppSetting ocr.provider_by_plan`) y llega en el body del request.
- El **parseo de boleta** (RUC, fecha, tabla de ítems, IGV) NO está aquí: lo hace
  `@fijaprecio/receipt-parser` en el worker, sobre `rawText` + `lines`.

## Railway

- Root Directory = `services/ocr`, builder Dockerfile (instala `tesseract-ocr-spa`).
- Sin dominio público. Lo llama el `worker`.
