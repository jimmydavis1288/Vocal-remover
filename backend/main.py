from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from demucs_runner import separate_job
from utils import (
    create_job,
    cleanup_job_later,
    ensure_environment,
    get_audio_duration,
    load_job,
    save_job,
    update_job,
    validate_upload,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("separator")

app = FastAPI(title="Demucs Vocal Separator", version="1.0.0")

DEFAULT_FRONTEND_ORIGINS = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "https://vocal-remover-beta-pink.vercel.app"
)
frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", DEFAULT_FRONTEND_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    try:
        ensure_environment()
    except RuntimeError as exc:
        logger.warning(str(exc))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, object]:
    contents = await file.read()
    filename = file.filename or "audio"
    try:
        validate_upload(filename, len(contents))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        ensure_environment()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="FFmpeg is not available. Install FFmpeg and make sure ffmpeg and ffprobe are on PATH.",
        ) from exc

    job = create_job(filename, len(contents))
    input_path = Path(job.input_path)
    input_path.write_bytes(contents)
    job.duration = get_audio_duration(input_path)
    save_job(job)

    return {
        "job_id": job.job_id,
        "filename": job.input_filename,
        "size": job.file_size,
        "duration": job.duration,
        "device": job.device,
        "status": job.status,
    }


@app.post("/separate")
async def separate(background_tasks: BackgroundTasks, job_id: str = Form(...)) -> dict[str, str]:
    try:
        job = load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Job not found.") from exc

    if job.state not in {"uploaded", "failed"}:
        raise HTTPException(status_code=409, detail=f"Job is already {job.state}.")

    update_job(job, state="queued", progress=10, status="Uploading...")
    background_tasks.add_task(separate_job, job)
    background_tasks.add_task(cleanup_job_later, job.job_id)
    return {"job_id": job.job_id, "status": "queued"}


@app.get("/status/{job_id}")
def status(job_id: str) -> dict[str, object]:
    try:
        job = load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Job not found or expired.") from exc

    return {
        "job_id": job.job_id,
        "state": job.state,
        "progress": job.progress,
        "status": job.status,
        "error": job.error,
        "filename": job.input_filename,
        "size": job.file_size,
        "duration": job.duration,
        "device": job.device,
        "elapsed_seconds": job.elapsed_seconds,
        "processing_speed": job.processing_speed,
        "outputs": {name: f"/download/{job.job_id}/{name}" for name in job.outputs},
    }


@app.get("/download/{job_id}/zip")
def download_zip(job_id: str) -> FileResponse:
    return download(job_id, "stems.zip")


@app.get("/download/{job_id}/{filename}")
def download(job_id: str, filename: str) -> FileResponse:
    try:
        job = load_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Job not found or expired.") from exc

    path = job.outputs.get(filename)
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="File not found.")
    media_type = "application/zip" if filename.endswith(".zip") else "audio/wav"
    return FileResponse(path, filename=filename, media_type=media_type)
