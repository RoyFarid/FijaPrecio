"""Contratos del endpoint /internal/ocr."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class OcrRequest(BaseModel):
    image_base64: str | None = Field(default=None, alias="imageBase64")
    image_url: str | None = Field(default=None, alias="imageUrl")
    provider: str | None = None

    @model_validator(mode="after")
    def _one_source(self) -> OcrRequest:
        if not self.image_base64 and not self.image_url:
            raise ValueError("imageBase64 o imageUrl es obligatorio")
        return self


class OcrLineOut(BaseModel):
    text: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1


class OcrResponse(BaseModel):
    rawText: str
    lines: list[OcrLineOut]
    provider: str
