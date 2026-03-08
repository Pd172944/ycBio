from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from core.config import settings
import os

app = FastAPI(
    title="BioOS API",
    description="Agentic Operating System for Biology Researchers", 
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from routers import auth, pipelines, runs, molecules, reports

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])  
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(molecules.router, prefix="/api/molecules", tags=["molecules"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/")
async def root():
    return {"message": "BioOS API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bioos-api"}


# Serve artifact files
@app.get("/api/artifacts/{run_id}/{filename}")
async def serve_artifact(run_id: str, filename: str):
    from core.files import artifact_path
    
    file_path = artifact_path(run_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    def file_generator():
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk
    
    # Determine content type
    content_type = "application/octet-stream"
    if filename.endswith('.pdb'):
        content_type = "text/plain"
    elif filename.endswith('.pdf'):
        content_type = "application/pdf"
    elif filename.endswith('.sdf'):
        content_type = "chemical/x-mdl-sdfile"
    
    return StreamingResponse(
        file_generator(),
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)