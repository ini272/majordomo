import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from sqlmodel import SQLModel
from app.routes import auth, home, user, quest, reward

# Load environment variables from .env file
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    from app.database import engine
    SQLModel.metadata.create_all(engine)
    yield
    # Shutdown
    pass


def create_app():
    """Factory function to create FastAPI app"""
    app = FastAPI(
        title="Grindstone API",
        description="A gamified chore quest system",
        version="0.1.0",
        lifespan=lifespan
    )
    return app


# Initialize FastAPI
app = create_app()

# Environment-specific CORS configuration
ENV = os.getenv("NODE_ENV", "development")
IS_PRODUCTION = ENV == "production"

if IS_PRODUCTION:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://grindstone.example.com"],  # Update with actual domain
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include routers
app.include_router(auth.router)
app.include_router(home.router)
app.include_router(user.router)
app.include_router(quest.router)
app.include_router(reward.router)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Grindstone API is running"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


def custom_openapi():
    """Configure OpenAPI schema with Bearer token security"""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Grindstone API",
        version="0.1.0",
        description="A gamified chore quest system",
        routes=app.routes,
    )
    
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    
    # Mark routes as requiring auth (except public routes)
    public_paths = ["/api/auth/login", "/api/homes/"] # POST /api/homes and POST /api/homes/{id}/join are public
    for path, methods in openapi_schema.get("paths", {}).items():
        if not any(path.startswith(p) for p in public_paths):
            for method in methods.values():
                if isinstance(method, dict):
                    method.setdefault("security", [{"bearerAuth": []}])
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
