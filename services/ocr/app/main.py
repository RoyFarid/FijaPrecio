"""Entrypoint del microservicio `ocr`.

  POST /internal/ocr   { imageUrl | imageBase64, provider? } -> { rawText, lines, provider }
  GET  /health · /health/ready

El worker de `api` llama a este endpoint. El parseo de boleta (RUC, tabla de
ítems, IGV) y el match contra CanonicalInput se hacen aguas abajo (@fijaprecio/receipt-parser).
"""

from __future__ import annotations

import asyncio
from typing import Annotated

import structlog
from fastapi import Depends, FastAPI, Header, HTTPException

from app.config import Settings, get_settings
from app.image_source import load_image_bytes
from app.models import OcrLineOut, OcrRequest, OcrResponse
from app.preprocess import preprocess
from app.providers import get_provider

log = structlog.get_logger("ocr")
app = FastAPI(title="FijaPrecio OCR")


def require_internal_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_token: Annotated[str, Header()] = "",
) -> None:
    if x_internal_token != settings.internal_api_token:
        raise HTTPException(status_code=401, detail="token interno inválido")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def ready() -> dict[str, object]:
    checks = {"tesseract": "down"}
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        checks["tesseract"] = "up"
    except Exception:  # noqa: BLE001
        pass
    ok = all(v == "up" for v in checks.values())
    return {"status": "ready" if ok else "degraded", "checks": checks}


@app.post(
    "/internal/ocr",
    dependencies=[Depends(require_internal_token)],
    response_model=OcrResponse,
)
async def ocr(
    req: OcrRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> OcrResponse:
    provider_name = (req.provider or settings.default_provider).lower()
    try:
        provider = get_provider(provider_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        raw = await load_image_bytes(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # cv2 + tesseract son síncronos y pesados → hilo aparte
    def _run() -> OcrResponse:
        image = preprocess(raw)
        result = provider.recognize(image)
        return OcrResponse(
            rawText=result.raw_text,
            lines=[
                OcrLineOut(text=ln.text, confidence=ln.confidence, bbox=ln.bbox)
                for ln in result.lines
            ],
            provider=result.provider,
        )

    try:
        response = await asyncio.to_thread(_run)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    log.info("ocr.done", provider=response.provider, lines=len(response.lines))
    return response
