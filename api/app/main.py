from app.accounts import app
"""ASGI entry point for the SensLab API.

Run with ``uvicorn app.main:app`` from the ``api`` directory.
"""

from app.accounts import app

__all__ = ["app"]
