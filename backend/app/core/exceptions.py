from fastapi import Request
from fastapi.responses import JSONResponse
from app.models.domain import IntentStatus

class ApiException(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", http_status: int = 500):
        self.message = message
        self.code = code
        self.http_status = http_status

async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, ApiException):
        return JSONResponse(
            status_code=exc.http_status,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": None
                }
            }
        )
    
    # Catch-all for unhandled exceptions
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(exc),
                "details": None
            }
        }
    )
