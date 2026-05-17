from typing import Annotated

from fastapi import Depends

from app.core.security import verify_api_key
from app.core.logger import app_logger

API_KEY_DEP = Annotated[str, Depends(verify_api_key)]


def get_api_key_dep(api_key: API_KEY_DEP) -> str:
    return api_key