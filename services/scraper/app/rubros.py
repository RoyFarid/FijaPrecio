"""Normalización de rubros y filtrado de fuentes por rubro.

Un `ScrapingSource` con `config.rubros = ["muebles"]` solo se consulta para
targets de ese rubro; sin `config.rubros` (o con `["general"]`) es universal.

Los alias (panadería → gastronomía, ...) tienen un default acá y se pueden
sobreescribir en `AppSetting` clave `scraper.rubro_aliases`
({ "<canon>": ["<alias>", ...] }).
"""

from __future__ import annotations

import unicodedata

Aliases = dict[str, list[str]]

DEFAULT_ALIASES: Aliases = {
    "gastronomia": [
        "gastronomia", "panaderia", "pasteleria", "reposteria", "abarrotes",
        "restaurante", "cafeteria", "comida", "bodega", "juguería", "jugueria",
    ],
    "muebles": [
        "muebles", "mueble", "carpinteria", "madera", "maderas", "melamina",
        "ferreteria", "construccion", "closet", "cocina", "tapiceria",
    ],
    "confeccion": [
        "confeccion", "textil", "textiles", "costura", "ropa", "avios",
        "sastreria", "bordado", "tejido",
    ],
}


def normalize(raw: str | None) -> str | None:
    if not raw:
        return None
    stripped = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    return stripped.lower().strip() or None


def canonical_rubro(raw: str | None, aliases: Aliases | None = None) -> str | None:
    """Lleva un rubro (posiblemente sucio: 'Pastelería') a su forma canónica."""
    n = normalize(raw)
    if n is None:
        return None
    table = aliases or DEFAULT_ALIASES
    for canon, names in table.items():
        if n == normalize(canon) or n in {normalize(x) for x in names}:
            return canon
    return n


def source_serves(
    source_rubros: list[str] | None,
    target_rubro: str | None,
    aliases: Aliases | None = None,
) -> bool:
    """¿Esta fuente aplica para un target de este rubro?

    - fuente sin `rubros` (o con "general") → sí, siempre
    - target sin rubro conocido → sí (no descartamos por falta de dato)
    - si no, el rubro canónico del target debe estar entre los de la fuente
    """
    if not source_rubros:
        return True
    served_norm = {normalize(r) for r in source_rubros}
    if "general" in served_norm:
        return True
    if target_rubro is None:
        return True
    served = {canonical_rubro(r, aliases) for r in source_rubros}
    return canonical_rubro(target_rubro, aliases) in served
