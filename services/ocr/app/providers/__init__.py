"""Registro de proveedores OCR. `ocr.provider_by_plan` (AppSetting) elige cuál."""

from __future__ import annotations

from functools import lru_cache

from app.providers.base import OcrLine, OcrProvider, OcrResult

_ALIASES = {"paddle": "paddle", "tesseract": "tesseract", "paddleocr": "paddle"}


@lru_cache
def get_provider(name: str) -> OcrProvider:
    canonical = _ALIASES.get(name.lower().strip(), name.lower().strip())
    if canonical == "tesseract":
        from app.providers.tesseract import TesseractProvider

        return TesseractProvider()
    if canonical == "paddle":
        from app.providers.paddle import PaddleProvider

        return PaddleProvider()
    raise ValueError(f"provider OCR desconocido: {name}")


__all__ = ["OcrLine", "OcrProvider", "OcrResult", "get_provider"]
