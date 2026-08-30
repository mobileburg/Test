#!/usr/bin/env python3
"""Загружает русскоязычные метаданные монет из официального API Банка России."""

from __future__ import annotations

import argparse
import json
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ENDPOINT = "https://www.cbr.ru/CoinsBaseWS/CoinsBaseWS.asmx"
SOAP_ACTION = "http://web.cbr.ru/SearchMonetXML"


def request_coins(year: int, investment: int) -> bytes:
    body = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SearchMonetXML xmlns="http://web.cbr.ru/">
      <SearchPhrase></SearchPhrase>
      <year>{year}</year>
      <nominal>-1</nominal>
      <metal_id>0</metal_id>
      <serie_id>0</serie_id>
      <is_investment>{investment}</is_investment>
    </SearchMonetXML>
  </soap:Body>
</soap:Envelope>""".encode()
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": SOAP_ACTION,
            "User-Agent": "NumismatDatasetBuilder/0.1",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    return (child.text or "").strip() if child is not None else ""


def parse(payload: bytes) -> list[dict[str, object]]:
    root = ET.fromstring(payload)
    records = []
    for coin in root.findall(".//CL"):
        catalog_number = text(coin, "CatNumber")
        records.append({
            "id": f"cbr:{catalog_number}",
            "catalog_number": catalog_number,
            "title_ru": text(coin, "cname"),
            "series_ru": text(coin, "sname"),
            "nominal_ru": text(coin, "nominal"),
            "metal_ru": text(coin, "metal"),
            "release_date": text(coin, "DT")[:10],
            "country_ru": "Россия",
            "source": "Банк России",
            "source_url": (
                "https://www.cbr.ru/cash_circulation/memorable_coins/"
                f"coins_base/ShowCoins/?cat_num={catalog_number}"
            ),
            "license_url": "https://www.cbr.ru/about/",
            "attribution": "Источник: Банк России",
        })
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=1992)
    parser.add_argument("--to-year", type=int, default=2026)
    parser.add_argument("--output", type=Path, default=Path("ml/data/cbr/manifest.jsonl"))
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    by_id: dict[str, dict[str, object]] = {}
    for year in range(args.from_year, args.to_year + 1):
        for investment in (0, 1):
            for record in parse(request_coins(year, investment)):
                by_id[str(record["id"])] = record
        print(f"{year}: всего {len(by_id)} записей")

    with args.output.open("w", encoding="utf-8") as target:
        for record in sorted(by_id.values(), key=lambda item: str(item["catalog_number"])):
            target.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Готово: {len(by_id)} записей, манифест {args.output}")


if __name__ == "__main__":
    main()
