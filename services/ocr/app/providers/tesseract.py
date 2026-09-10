"""Adaptador Tesseract: agrupa palabras en líneas y calcula bbox + confianza."""

from __future__ import annotations

from typing import NamedTuple

import numpy as np
import pytesseract

from app.config import get_settings
from app.providers.base import OcrLine, OcrResult


class _Word(NamedTuple):
    text: str
    conf: float
    left: int
    top: int
    right: int
    bottom: int


class TesseractProvider:
    name = "tesseract"

    def recognize(self, image: np.ndarray) -> OcrResult:
        lang = get_settings().tesseract_lang
        data = pytesseract.image_to_data(
            image, lang=lang, output_type=pytesseract.Output.DICT
        )

        groups: dict[tuple[int, int, int], list[_Word]] = {}
        for i in range(len(data["text"])):
            text = str(data["text"][i]).strip()
            conf = float(data["conf"][i])
            if not text or conf < 0:
                continue
            left, top = int(data["left"][i]), int(data["top"][i])
            key = (
                int(data["block_num"][i]),
                int(data["par_num"][i]),
                int(data["line_num"][i]),
            )
            groups.setdefault(key, []).append(
                _Word(
                    text=text,
                    conf=conf,
                    left=left,
                    top=top,
                    right=left + int(data["width"][i]),
                    bottom=top + int(data["height"][i]),
                )
            )

        lines: list[OcrLine] = []
        for words in groups.values():
            confs = [w.conf for w in words]
            lines.append(
                OcrLine(
                    text=" ".join(w.text for w in words),
                    confidence=round(sum(confs) / len(confs) / 100.0, 4),
                    bbox=(
                        float(min(w.left for w in words)),
                        float(min(w.top for w in words)),
                        float(max(w.right for w in words)),
                        float(max(w.bottom for w in words)),
                    ),
                )
            )

        lines.sort(key=lambda ln: (ln.bbox[1], ln.bbox[0]))
        return OcrResult(
            raw_text="\n".join(ln.text for ln in lines), lines=lines, provider=self.name
        )
