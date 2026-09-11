"""Normalización de rubros y filtrado de fuentes (`app/rubros.py`)."""

from __future__ import annotations

import pytest

from app.rubros import canonical_rubro, normalize, source_serves


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Pastelería", "pasteleria"),
        ("  GASTRONOMÍA ", "gastronomia"),
        ("", None),
        (None, None),
    ],
)
def test_normalize(raw: str | None, expected: str | None) -> None:
    assert normalize(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("gastronomia", "gastronomia"),
        ("Panadería", "gastronomia"),
        ("pastelería", "gastronomia"),
        ("Carpintería", "muebles"),
        ("ferreteria", "muebles"),
        ("Textiles", "confeccion"),
        ("nauticaXYZ", "nauticaxyz"),  # desconocido → normalizado tal cual
        (None, None),
    ],
)
def test_canonical_rubro(raw: str | None, expected: str | None) -> None:
    assert canonical_rubro(raw) == expected


def test_source_serves_universal_when_no_rubros() -> None:
    assert source_serves(None, "gastronomia") is True
    assert source_serves([], "muebles") is True
    assert source_serves(["general"], "confeccion") is True


def test_source_serves_matches_by_canonical_rubro() -> None:
    muebles = ["muebles"]
    assert source_serves(muebles, "muebles") is True
    assert source_serves(muebles, "Carpintería") is True  # alias
    assert source_serves(muebles, "gastronomia") is False
    assert source_serves(muebles, "Panadería") is False


def test_source_serves_keeps_source_when_target_rubro_unknown() -> None:
    # rubro del target None → no se descarta la fuente (mejor de más que de menos)
    assert source_serves(["gastronomia"], None) is True


def test_source_serves_respects_alias_override() -> None:
    aliases = {"gastronomia": ["gastronomia", "delivery"]}
    assert source_serves(["gastronomia"], "delivery", aliases) is True
    # "panaderia" ya NO cuenta con este override
    assert source_serves(["gastronomia"], "panaderia", aliases) is False
