from typing import Any, Callable

from fastapi import Depends, FastAPI, HTTPException


def register_player_data_routes(app: FastAPI, get_client: Callable, signed_in_user: Callable) -> None:
    @app.post("/calibrations", status_code=201, tags=["player data"])
    def save_calibration(payload: dict[str, Any], user: dict[str, str] = Depends(signed_in_user)):
        calibration_id = payload.get("id")
        data = payload.get("data")
        if not isinstance(calibration_id, str) or not isinstance(data, dict):
            raise HTTPException(status_code=422, detail="Calibration needs an id and data object.")
        get_client().table("calibrations").upsert({
            "user_id": user["id"], "id": calibration_id, "data": data,
        }, on_conflict="user_id,id").execute()
        return {"status": "saved", "id": calibration_id}

    @app.post("/rounds", status_code=201, tags=["player data"])
    def save_round(payload: dict[str, Any], user: dict[str, str] = Depends(signed_in_user)):
        record_id = payload.get("id")
        data = payload.get("data")
        if not isinstance(record_id, str) or not isinstance(data, dict):
            raise HTTPException(status_code=422, detail="Round needs an id and data object.")
        get_client().table("practice_rounds").upsert({
            "user_id": user["id"], "id": record_id, "data": data,
        }, on_conflict="user_id,id", ignore_duplicates=True).execute()
        return {"status": "saved", "id": record_id}
