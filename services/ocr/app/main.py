"""Entrypoint del microservicio `ocr`.

  POST /internal/ocr   -> { imageUrl | imageBase64, provider? } -> líneas + texto
  GET  /health

El worker de `api` llama a este endpoint; el parseo de boleta (RUC, tabla de
ítems, IGV) y el match contra CanonicalInput se hacen aguas abajo.
"""

from fastapi import Depends, FastAPI, Header, HTTPException

from app.config import Settings, get_settings

app = FastAPI(title="FijaPrecio OCR")


def require_internal_token(
    x_internal_token: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    if x_internal_token != settings.internal_api_token:
        raise HTTPException(status_code=401, detail="token interno inválido")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/ocr", dependencies=[Depends(require_internal_token)])
async def ocr(payload: dict) -> dict[str, object]:
    # TODO: descargar imagen, preprocesar (OpenCV: deskew/threshold),
    #       provider = get_provider(payload.get("provider") or settings.default_provider),
    #       result = await provider.recognize(image_bytes),
    #       devolver { rawText, lines, provider }.
    return {"rawText": "", "lines": [], "provider": get_settings().default_provider}
