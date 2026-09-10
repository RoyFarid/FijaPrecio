"""Interfaz `OcrProvider` — adaptadores intercambiables.

Primario: TesseractProvider (self-host, funciona hoy). Espacio para PaddleProvider
(extra `paddle`) y cloud (Textract / Vision / Gemini). El flujo de parseo de
boletas aguas abajo no cambia según el provider.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np


@dataclass(slots=True)
class OcrLine:
    text: str
    confidence: float  # 0..1
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1


@dataclass(slots=True)
class OcrResult:
    raw_text: str
    lines: list[OcrLine] = field(default_factory=list)
    provider: str = ""


class OcrProvider(Protocol):
    name: str

    def recognize(self, image: np.ndarray) -> OcrResult: ...
