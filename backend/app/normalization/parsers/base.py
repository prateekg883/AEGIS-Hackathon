from abc import ABC, abstractmethod
from typing import Any


class BaseParser(ABC):
    """
    Abstract base class for all file format parsers in AEGIS.
    """

    format_name: str = "GENERIC"

    @abstractmethod
    def parse(self, content: bytes, filename: str = "") -> list[dict[str, Any]]:
        """
        Parse raw bytes into a list of key-value dictionaries.
        """
        pass
