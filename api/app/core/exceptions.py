"""Domain errors — raised by services, mapped to HTTP responses in main.py.

`code` is a stable machine-readable identifier the frontend translates; `detail` stays
English and is what logs and API clients without translations see.
"""


class AppError(Exception):
    status_code: int = 400

    def __init__(
        self, detail: str, status_code: int | None = None, *, code: str | None = None
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.code = code
        if status_code is not None:
            self.status_code = status_code


class AuthError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class UnprocessableError(AppError):
    """Well-formed request, but the payload itself can't be processed (bad upload)."""

    status_code = 422
