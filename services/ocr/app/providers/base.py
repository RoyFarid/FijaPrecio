"""Interfaz `OcrProvider` — adaptadores intercambiables.

Primario: PaddleProvider (self-host). Fallback: TesseractProvider.
Futuros: TextractProvider / VisionProvider / GeminiProvider (solo se activan
por config/plan; el flujo de parseo de boletas no cambia).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(slots=True)
class OcrLine:
    text: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1


@dataclass(slots=True)
class OcrResult:
    raw_text: str
    lines: list[OcrLine] = field(default_factory=list)
    provider: str = ""


class OcrProvider(Protocol):
    name: str

    async def recognize(self, image_bytes: bytes) -> OcrResult: ...


def get_provider(name: str) -> OcrProvider:
    """Resuelve el provider por nombre. Registra aquí los adaptadores."""
    raise NotImplementedError(f"provider OCR no implementado: {name}")
