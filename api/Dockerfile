# FastAPI + MongoDB backend.
FROM python:3.12-slim

# uv resolves and installs from the committed lockfile — same versions as local dev.
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local \
    PYTHONUNBUFFERED=1

# Dependencies first: this layer is cached until pyproject/uv.lock change.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY app ./app
COPY scripts ./scripts

# Uploaded artifacts live outside the image; compose mounts the directory.
# No VOLUME instruction here on purpose — it would create an anonymous volume that
# shadows whatever gets mounted at the parent path.
ENV STORAGE_DIR=/data/storage

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
