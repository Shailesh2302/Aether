import logging
import sys
from typing import Any

from app.core.config import get_settings

settings = get_settings()


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)

    if not logger.handlers:
        logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)

        logger.addHandler(handler)

    return logger


app_logger = setup_logger("omnimind")
request_logger = setup_logger("omnimind.requests")
error_logger = setup_logger("omnimind.errors")


def log_request(method: str, path: str, status_code: int, duration: float) -> None:
    request_logger.info(f"{method} {path} {status_code} {duration:.3f}s")


def log_error(error: Exception, context: Any = None) -> None:
    error_logger.error(f"{type(error).__name__}: {str(error)}")
    if context:
        error_logger.error(f"Context: {context}")