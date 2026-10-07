import os
import logging
from functools import lru_cache
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.player_data import register_player_data_routes

bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def create_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if not url or not key:
        raise HTTPException(status_code=503, detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.")
    return create_client(url, key)


@lru_cache(maxsize=1)
def supabase_client() -> Client:
    return create_supabase_client()


def public_user(user: Any) -> dict[str, str]:
    return {"id": str(user.id), "email": str(user.email or "")}


production = os.getenv("APP_ENV") == "production"
app = FastAPI(
    title="SensLab API",
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
)
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("API_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class ProfilePayload(BaseModel):
    data: dict[str, Any]


def signed_in_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, str]:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please sign in to save and view your SensLab data.")
    try:
        response = create_supabase_client().auth.get_user(credentials.credentials)
        user = response.user
        if user is None:
            raise ValueError("No user in auth response")
        return public_user(user)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.") from error


def auth_session_response(response: Any) -> dict[str, Any]:
    user = getattr(response, "user", None)
    session = getattr(response, "session", None)
    if session is None or user is None:
        return {"confirmation_required": True}
    return {"access_token": session.access_token, "token_type": "bearer", "user": public_user(user)}


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    try:
        supabase_client().table("player_profiles").select("user_id").limit(1).execute()
        return {"status": "ok", "supabase": "connected"}
    except Exception as error:
        status = getattr(error, "status_code", None)
        code = str(getattr(error, "code", ""))
        error_type = type(error).__name__
        reason = str(error)
        secret = os.getenv("SUPABASE_SECRET_KEY", "")
        project_url = os.getenv("SUPABASE_URL", "")
        if secret:
            reason = reason.replace(secret, "[secret key redacted]")
        if project_url:
            reason = reason.replace(project_url, "[project URL redacted]")
        reason = " ".join(reason.split())[:240]
        logger.error("Supabase health check failed (type=%s, status=%s, code=%s, reason=%s)", error_type, status, code, reason)
        message = str(error).lower()
        if status in (401, 403):
            detail = "Supabase rejected the secret key. In Project Settings → API Keys, copy a Secret key (not the publishable key) into SUPABASE_SECRET_KEY."
        elif code in ("PGRST205", "42P01") or status == 404 or "player_profiles" in message or "schema cache" in message:
            detail = "Supabase is reachable, but SensLab tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
        elif error_type in ("ConnectError", "ConnectTimeout", "ReadTimeout", "TimeoutException"):
            detail = "The API could not reach Supabase. Check the project URL, internet access, and whether the Supabase project is active."
        else:
            detail = f"Supabase request failed ({error_type}, HTTP {status or 'unknown'}, code {code or 'unknown'}): {reason or 'No reason returned.'}"
        raise HTTPException(status_code=503, detail=detail) from error


@app.post("/auth/signup", status_code=201, tags=["account"])
def sign_up(payload: Credentials) -> dict[str, Any]:
    try:
        redirect_url = os.getenv("APP_SITE_URL", "http://localhost:3000").rstrip("/") + "/login"
        response = create_supabase_client().auth.sign_up({
            "email": payload.email.strip().lower(),
            "password": payload.password,
            "options": {"email_redirect_to": redirect_url},
        })
        return auth_session_response(response)
    except Exception as error:
        error_code = str(getattr(error, "code", "")).lower()
        error_message = str(error).lower()
        if error_code == "email_address_not_authorized" or "email address not authorized" in error_message:
            detail = "Supabase's built-in email sender only sends to your project team. Configure custom SMTP in Supabase Authentication settings to email other addresses."
        elif error_code == "over_email_send_rate_limit" or "rate limit" in error_message:
            detail = "Supabase's email sending limit was reached. Wait before requesting another confirmation email, or configure custom SMTP."
        else:
            detail = "Supabase could not create the account. Check Supabase Authentication logs for the signup error."
        raise HTTPException(status_code=400, detail=detail) from error


@app.post("/auth/login", tags=["account"])
def log_in(payload: Credentials) -> dict[str, Any]:
    try:
        response = create_supabase_client().auth.sign_in_with_password({"email": payload.email.strip().lower(), "password": payload.password})
        session_response = auth_session_response(response)
        if session_response.get("confirmation_required"):
            raise HTTPException(status_code=401, detail="Confirm your email before logging in.")
        return session_response
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Email or password is incorrect, or the email is not confirmed yet.") from error


@app.get("/auth/me", tags=["account"])
def account_details(user: dict[str, str] = Depends(signed_in_user)) -> dict[str, str]:
    return user


@app.get("/profile", tags=["player data"])
def get_profile(user: dict[str, str] = Depends(signed_in_user)) -> dict[str, Any]:
    rows = supabase_client().table("player_profiles").select("data").eq("user_id", user["id"]).limit(1).execute().data
    return {"data": rows[0]["data"] if rows else None}


@app.put("/profile", tags=["player data"])
def save_profile(payload: ProfilePayload, user: dict[str, str] = Depends(signed_in_user)) -> dict[str, str]:
    supabase_client().table("player_profiles").upsert({"user_id": user["id"], "data": payload.data}).execute()
    calibration = payload.data.get("calibration", {})
    calibration_id = calibration.get("calibrationId")
    if calibration.get("phase") == "done" and calibration_id:
        supabase_client().table("calibrations").upsert({
            "user_id": user["id"], "id": str(calibration_id), "data": calibration,
        }, on_conflict="user_id,id").execute()
    return {"status": "saved"}


@app.get("/history", tags=["player data"])
def player_history(user: dict[str, str] = Depends(signed_in_user)) -> dict[str, list[dict[str, Any]]]:
    client = supabase_client()
    calibrations = client.table("calibrations").select("id,data,created_at,updated_at").eq("user_id", user["id"]).order("created_at", desc=True).execute().data
    stored_rounds = client.table("practice_rounds").select("id,data,created_at").eq("user_id", user["id"]).order("created_at", desc=True).execute().data
    rounds = []
    for row in stored_rounds:
        data = row.get("data") or {}
        settings = data.get("settings") or {}
        rounds.append({
            "id": row["id"],
            "created_at": row["created_at"],
            "data": {
                "candidateLabel": data.get("candidateLabel") or settings.get("candidateLabel"),
                "drill": data.get("drill") or settings.get("drillType"),
                "gameDpi": data.get("gameDpi") or settings.get("gameDpi"),
                "metrics": data.get("metrics") or {},
                "mouseSampleCount": len(data.get("mouseSamples") or []),
                "clickCount": len(data.get("clickTimes") or []),
                "savedAt": data.get("savedAt"),
            },
        })
    return {"calibrations": calibrations, "rounds": rounds}


register_player_data_routes(app, supabase_client, signed_in_user)
