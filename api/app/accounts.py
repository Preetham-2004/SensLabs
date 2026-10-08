import os
import logging
import ipaddress
from functools import lru_cache
from hashlib import sha256
import hmac
from typing import Any, Literal
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.player_data import register_player_data_routes

bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

SESSION_COOKIE = "senslab_session"
SESSION_MAX_AGE = 60 * 60
AUTH_RATE_LIMIT_MAX_PER_IP = 120
AUTH_RATE_LIMIT_MAX_PER_ACCOUNT = 8
MAX_REQUEST_BYTES = 8 * 1024 * 1024


def check_auth_rate_limit(request: Request, payload: Any = None) -> None:
    client_ip = request.client.host if request.client else "unknown"
    email = str(getattr(payload, "email", "")).strip().lower()
    pepper = os.getenv("SUPABASE_SECRET_KEY", "").encode()
    if not pepper:
        raise HTTPException(status_code=503, detail="Sign-in is temporarily unavailable. Please try again shortly.")
    ip_key = hmac.new(pepper, client_ip.encode(), sha256).hexdigest()
    account_key = hmac.new(pepper, f"{client_ip}\0{email}".encode(), sha256).hexdigest()
    try:
        client = supabase_client()
        ip_result = client.rpc("consume_auth_rate_limit", {"p_key_hash": ip_key, "p_limit": AUTH_RATE_LIMIT_MAX_PER_IP}).execute().data
        account_result = client.rpc("consume_auth_rate_limit", {"p_key_hash": account_key, "p_limit": AUTH_RATE_LIMIT_MAX_PER_ACCOUNT}).execute().data
        if ip_result is not True or account_result is not True:
            raise HTTPException(status_code=429, detail="Too many sign-in or account creation attempts. Please wait a minute before trying again.")
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Shared sign-in rate limiter failed")
        raise HTTPException(status_code=503, detail="Sign-in is temporarily unavailable. Please try again shortly.") from error


def create_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if not url or not key:
        raise HTTPException(status_code=503, detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.")
    return create_client(url, key)


@lru_cache(maxsize=1)
def supabase_client() -> Client:
    return create_supabase_client()


def account_profile(user_id: str) -> dict[str, Any] | None:
    rows = (
        supabase_client()
        .table("user_profiles")
        .select("username,preferred_game")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def public_user(user: Any, profile: dict[str, Any] | None = None) -> dict[str, Any]:
    # Metadata fallback keeps existing accounts working until their profile is saved.
    metadata = getattr(user, "user_metadata", None) or {}
    profile = profile or {}
    game = profile.get("preferred_game") or metadata.get("preferred_game")
    return {
        "id": str(user.id),
        "email": str(user.email or ""),
        "username": str(profile.get("username") or metadata.get("username") or ""),
        "preferred_game": game if game in ("valorant", "cs2") else None,
    }


def is_allowed_origin(origin: str) -> bool:
    normalized = origin.rstrip("/")
    if normalized in allowed_origins:
        return True
    if production:
        return False
    try:
        parsed = urlsplit(normalized)
        address = ipaddress.ip_address(parsed.hostname or "")
        return (
            parsed.scheme == "http"
            and parsed.port == 3000
            and parsed.username is None
            and parsed.password is None
            and not parsed.path
            and not parsed.query
            and not parsed.fragment
            and address.is_private
        )
    except ValueError:
        return False


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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def protect_cookie_mutations(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                return Response("Request body is too large.", status_code=413)
        except ValueError:
            return Response("Invalid request size.", status_code=400)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin", "").rstrip("/")
        if not is_allowed_origin(origin):
            return Response("Origin is missing or not allowed.", status_code=403)
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class SignupPayload(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    preferred_game: Literal["valorant", "cs2"]


class AccountProfilePayload(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    preferred_game: Literal["valorant", "cs2"]


class ProfilePayload(BaseModel):
    data: dict[str, Any]


def signed_in_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    access_token = request.cookies.get(SESSION_COOKIE) or (credentials.credentials if credentials else None)
    if access_token is None:
        raise HTTPException(status_code=401, detail="Please sign in to save and view your SensLab data.")
    try:
        response = supabase_client().auth.get_user(access_token)
        user = response.user
        if user is None:
            raise ValueError("No user in auth response")
        return public_user(user, account_profile(str(user.id)))
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.") from error


def auth_session_response(auth_response: Any, response: Response) -> dict[str, Any]:
    user = getattr(auth_response, "user", None)
    session = getattr(auth_response, "session", None)
    if session is None or user is None:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    response.set_cookie(
        SESSION_COOKIE,
        session.access_token,
        max_age=min(int(getattr(session, "expires_in", SESSION_MAX_AGE) or SESSION_MAX_AGE), SESSION_MAX_AGE),
        httponly=True,
        secure=production,
        samesite="lax",
        path="/",
    )
    return {
        "user": public_user(user, account_profile(str(user.id))),
    }



@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    try:
        client = supabase_client()
        client.table("player_profiles").select("user_id").limit(1).execute()
        client.table("user_profiles").select("user_id").limit(1).execute()
        client.rpc("consume_auth_rate_limit", {"p_key_hash": "0" * 64, "p_limit": 1000}).execute()
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
        elif code == "42501" or "permission denied" in message:
            detail = "Supabase denied table access. Restart the API after the latest update; if it continues, confirm its secret key has service-role access and rerun the schema grants."
        elif code in ("PGRST205", "42P01") or status == 404 or "player_profiles" in message or "user_profiles" in message or "schema cache" in message:
            detail = "Supabase is reachable, but SensLab tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
        elif error_type in ("ConnectError", "ConnectTimeout", "ReadTimeout", "TimeoutException"):
            detail = "The API could not reach Supabase. Check the project URL, internet access, and whether the Supabase project is active."
        else:
            detail = f"Supabase request failed ({error_type}, HTTP {status or 'unknown'}, code {code or 'unknown'}): {reason or 'No reason returned.'}" if not production else "Supabase service request failed. Please check backend logs."
        raise HTTPException(status_code=503, detail=detail) from error


@app.post("/auth/signup", status_code=201, tags=["account"])
def sign_up(payload: SignupPayload, request: Request, response: Response) -> dict[str, Any]:
    try:
        check_auth_rate_limit(request, payload)
        client = supabase_client()
        publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
        if not publishable_key:
            raise HTTPException(status_code=503, detail="Account creation is not configured. Set SUPABASE_PUBLISHABLE_KEY.")
        email = payload.email.strip().lower()
        created = client.auth.admin.create_user({
            "email": email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"username": payload.username, "preferred_game": payload.preferred_game},
        })
        created_user = getattr(created, "user", None)
        if created_user is None:
            raise ValueError("Supabase did not return the created account")
        profile = {
            "user_id": str(created_user.id),
            "username": payload.username,
            "preferred_game": payload.preferred_game,
        }
        try:
            client.table("user_profiles").insert(profile).execute()
        except Exception:
            # Avoid leaving an account behind if its required profile cannot be saved.
            try:
                client.auth.admin.delete_user(str(created_user.id))
            except Exception as cleanup_error:
                logger.error("Could not clean up incomplete signup (type=%s)", type(cleanup_error).__name__)
            raise
        session_client = create_client(os.getenv("SUPABASE_URL", "").strip(), publishable_key)
        auth_response = session_client.auth.sign_in_with_password({"email": email, "password": payload.password})
        return auth_session_response(auth_response, response)
    except HTTPException:
        raise
    except Exception as error:
        error_code = str(getattr(error, "code", ""))
        error_status = getattr(error, "status", None) or getattr(error, "status_code", None)
        error_text = str(error).lower()
        logger.warning("Signup failed (type=%s, code=%s, status=%s)", type(error).__name__, error_code, error_status)
        if str(error_status) == "429" or "email rate limit exceeded" in error_text:
            raise HTTPException(status_code=429, detail="Supabase temporarily limited signups. Wait a few minutes, then try once.") from error
        if error_code == "23505":
            raise HTTPException(status_code=409, detail="That username is already taken. Choose another username.") from error
        if "email address" in error_text and "invalid" in error_text:
            raise HTTPException(status_code=422, detail="Enter a valid email address.") from error
        if "user already registered" in error_text or "already been registered" in error_text or error_code == "23503":
            raise HTTPException(status_code=409, detail="This email may already have an account. Try logging in instead.") from error
        raise HTTPException(status_code=400, detail="Could not create the account. The email may already be registered or the username may already be taken.") from error


@app.post("/auth/login", tags=["account"])
def log_in(payload: Credentials, request: Request, response: Response) -> dict[str, Any]:
    try:
        check_auth_rate_limit(request, payload)
        # Keep user auth sessions separate from the service-role client used for
        # database access. Supabase clients retain the session after sign-in.
        session_client = create_supabase_client()
        auth_response = session_client.auth.sign_in_with_password({"email": payload.email.strip().lower(), "password": payload.password})
        session_response = auth_session_response(auth_response, response)
        return session_response
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.") from error


@app.post("/auth/session", tags=["account"])
def establish_session(request: Request, response: Response, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    check_auth_rate_limit(request)
    if credentials is None:
        raise HTTPException(status_code=401, detail="The session is missing its sign-in token.")
    try:
        current = supabase_client().auth.get_user(credentials.credentials).user
        if current is None:
            raise ValueError("No user in auth response")
        response.set_cookie(
            SESSION_COOKIE,
            credentials.credentials,
            max_age=SESSION_MAX_AGE,
            httponly=True,
            secure=production,
            samesite="lax",
            path="/",
        )
        return public_user(current, account_profile(str(current.id)))
    except Exception as error:
        raise HTTPException(status_code=401, detail="The session is invalid or expired. Please sign in again.") from error


@app.post("/auth/logout", tags=["account"])
def log_out(response: Response) -> dict[str, str]:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=production, samesite="lax")
    return {"status": "signed_out"}


@app.get("/auth/me", tags=["account"])
def account_details(user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, Any]:
    return user


@app.patch("/auth/profile", tags=["account"])
def update_account(payload: AccountProfilePayload, user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, Any]:
    try:
        supabase_client().table("user_profiles").upsert({
            "user_id": user["id"],
            "username": payload.username,
            "preferred_game": payload.preferred_game,
        }).execute()
        return {
            "id": user["id"],
            "email": user["email"],
            "username": payload.username,
            "preferred_game": payload.preferred_game,
        }
    except Exception as error:
        logger.exception("Could not update account preferences")
        raise HTTPException(status_code=502, detail="Could not update your account. Please try again.") from error


@app.delete("/auth/account", tags=["account"])
def delete_account(response: Response, user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, str]:
    try:
        # All SensLab tables reference auth.users with ON DELETE CASCADE.
        supabase_client().auth.admin.delete_user(user["id"])
        response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=production, samesite="lax")
        return {"status": "deleted"}
    except Exception as error:
        logger.exception("Could not delete account %s", user["id"])
        raise HTTPException(status_code=502, detail="Could not delete your account. Please try again.") from error


@app.get("/profile", tags=["player data"])
def get_profile(user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, Any]:
    rows = supabase_client().table("player_profiles").select("data").eq("user_id", user["id"]).limit(1).execute().data
    return {"data": rows[0]["data"] if rows else None}


@app.put("/profile", tags=["player data"])
def save_profile(payload: ProfilePayload, user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, str]:
    supabase_client().table("player_profiles").upsert({"user_id": user["id"], "data": payload.data}).execute()
    calibration = payload.data.get("calibration", {})
    calibration_id = calibration.get("calibrationId")
    if calibration.get("phase") == "done" and calibration_id:
        supabase_client().table("calibrations").upsert({
            "user_id": user["id"], "id": str(calibration_id), "data": calibration,
        }, on_conflict="user_id,id").execute()
    return {"status": "saved"}


@app.get("/history", tags=["player data"])
def player_history(user: dict[str, Any] = Depends(signed_in_user)) -> dict[str, list[dict[str, Any]]]:
    client = supabase_client()
    calibrations = client.table("calibrations").select("id,data,created_at,updated_at").eq("user_id", user["id"]).order("created_at", desc=True).execute().data
    stored_rounds = client.table("practice_rounds").select("id,data,created_at").eq("user_id", user["id"]).order("created_at", desc=True).execute().data
    rounds = []
    for row in stored_rounds:
        data = row.get("data") or {}
        settings = data.get("settings") or {}
        movement_style_source = data.get("movementStyleEstimate")
        movement_style = None
        if isinstance(movement_style_source, dict):
            movement_style = {key: value for key, value in movement_style_source.items() if key != "flicks"}
            movement_style["flickCount"] = len(movement_style_source.get("flicks") or [])
        rounds.append({
            "id": row["id"],
            "created_at": row["created_at"],
            "data": {
                "game": data.get("game"),
                "candidateLabel": data.get("candidateLabel") or settings.get("candidateLabel"),
                "drill": data.get("drill") or settings.get("drillType"),
                "gameDpi": data.get("gameDpi") or settings.get("gameDpi"),
                "baselineCounts": settings.get("baselineCounts"),
                "trackingSpeed": settings.get("trackingSpeed"),
                "crosshairShape": settings.get("crosshairShape"),
                "crosshairColor": settings.get("crosshairColor"),
                "crosshairSize": settings.get("crosshairSize"),
                "crosshairGap": settings.get("crosshairGap"),
                "cm360": data.get("cm360"),
                "startedAt": data.get("startedAt"),
                "endedAt": data.get("endedAt"),
                "metrics": data.get("metrics") or {},
                "movementStyleEstimate": movement_style,
                "mouseSampleCount": len(data.get("mouseSamples") or []),
                "clickCount": len(data.get("clickTimes") or []),
                "savedAt": data.get("savedAt"),
            },
        })
    return {"calibrations": calibrations, "rounds": rounds}


register_player_data_routes(app, supabase_client, signed_in_user)
