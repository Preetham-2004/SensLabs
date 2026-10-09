from typing import Any, Callable
import json
import re

from fastapi import Depends, FastAPI, HTTPException

MAX_RECORD_BYTES = 512 * 1024
RECORD_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def validate_record(record_id: Any, data: Any, label: str) -> tuple[str, dict[str, Any]]:
    if not isinstance(record_id, str) or not RECORD_ID_PATTERN.fullmatch(record_id):
        raise HTTPException(status_code=422, detail=f"{label} needs a valid id.")
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail=f"{label} needs a data object.")
    try:
        size = len(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError, RecursionError) as error:
        raise HTTPException(status_code=422, detail=f"{label} data is not valid JSON.") from error
    if size > MAX_RECORD_BYTES:
        raise HTTPException(status_code=413, detail=f"{label} is too large. Reduce its saved data and try again.")
    return record_id, data


def register_player_data_routes(app: FastAPI, get_client: Callable, signed_in_user: Callable) -> None:
    @app.post("/calibrations", status_code=201, tags=["player data"])
    def save_calibration(payload: dict[str, Any], user: dict[str, str] = Depends(signed_in_user)):
        calibration_id, data = validate_record(payload.get("id"), payload.get("data"), "Calibration")
        get_client().table("calibrations").upsert({
            "user_id": user["id"], "id": calibration_id, "data": data,
        }, on_conflict="user_id,id").execute()
        return {"status": "saved", "id": calibration_id}

    @app.post("/rounds", status_code=201, tags=["player data"])
    def save_round(payload: dict[str, Any], user: dict[str, str] = Depends(signed_in_user)):
        record_id, data = validate_record(payload.get("id"), payload.get("data"), "Round")
        get_client().table("practice_rounds").upsert({
            "user_id": user["id"], "id": record_id, "data": data,
        }, on_conflict="user_id,id", ignore_duplicates=True).execute()
        return {"status": "saved", "id": record_id}
