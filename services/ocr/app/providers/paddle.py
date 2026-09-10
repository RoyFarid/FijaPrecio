"""Adaptador PaddleOCR — solo si se instaló el extra `paddle` (imagen pesada)."""

from __future__ import annotations

import numpy as np

from app.providers.base import OcrLine, OcrResult


class PaddleProvider:
    name = "paddle"

    def __init__(self) -> None:
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:  # pragma: no cover - depende del extra
            raise RuntimeError(
                "PaddleProvider requiere el extra `paddle` (uv sync --extra paddle)"
            ) from exc
        self._ocr = PaddleOCR(use_angle_cls=True, lang="es", show_log=False)

    def recognize(self, image: np.ndarray) -> OcrResult:  # pragma: no cover
        result = self._ocr.ocr(image, cls=True)
        lines: list[OcrLine] = []
        for page in result or []:
            for box, (text, conf) in page or []:
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]
                lines.append(
                    OcrLine(
                        text=str(text),
                        confidence=round(float(conf), 4),
                        bbox=(min(xs), min(ys), max(xs), max(ys)),
                    )
                )
        lines.sort(key=lambda ln: (ln.bbox[1], ln.bbox[0]))
        return OcrResult(
            raw_text="\n".join(ln.text for ln in lines), lines=lines, provider=self.name
        )
