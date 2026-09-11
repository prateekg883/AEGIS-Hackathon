from typing import Any
import xml.etree.ElementTree as ET
try:
    import defusedxml.ElementTree as DefusedET
    ET_MODULE = DefusedET
except ImportError:
    ET_MODULE = ET

from app.normalization.parsers.base import BaseParser


class XMLParser(BaseParser):
    format_name = "XML"

    def parse(self, content: bytes, filename: str = "") -> list[dict[str, Any]]:
        text_content = None
        for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                text_content = content.decode(enc)
                break
            except Exception:
                continue
        if text_content is None:
            text_content = content.decode("utf-8", errors="ignore")

        try:
            root = ET_MODULE.fromstring(text_content)
        except Exception as exc:
            raise ValueError(f"Unable to parse XML content: {str(exc)}")

        records = []
        # Find candidate record nodes: look for children of root, or children of common wrapper tags
        children = list(root)
        if not children:
            # Single root record
            row = self._element_to_dict(root)
            if row:
                records.append(row)
            return records

        # If root has a wrapper (e.g. <records><record>... or <events><event>...)
        for child in children:
            row = self._element_to_dict(child)
            if row:
                records.append(row)

        if not records:
            raise ValueError("No valid record elements found in XML")

        return records

    def _element_to_dict(self, elem: ET.Element) -> dict[str, Any]:
        result: dict[str, Any] = {}
        # Include XML attributes
        for k, v in elem.attrib.items():
            result[k] = v

        # Include child elements
        for child in elem:
            tag = child.tag
            # Remove namespace if present
            if "}" in tag:
                tag = tag.split("}", 1)[1]
            
            child_children = list(child)
            if child_children:
                nested = self._element_to_dict(child)
                for nk, nv in nested.items():
                    result[f"{tag}_{nk}"] = nv
            else:
                val = (child.text or "").strip()
                if val:
                    result[tag] = val

        # If element has no children but has text
        if not list(elem) and elem.text and elem.text.strip():
            tag = elem.tag
            if "}" in tag:
                tag = tag.split("}", 1)[1]
            result[tag] = elem.text.strip()

        return result
