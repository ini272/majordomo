FROM python:3.9-slim

WORKDIR /app

# Install uv for fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv (much faster than pip)
RUN uv sync --frozen --no-dev

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application using uv
CMD ["uv", "run", "python", "main.py"]
