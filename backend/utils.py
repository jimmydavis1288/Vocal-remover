from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

import torch

logger = logging.getLogger("separator")

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".mp4a"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
JOBS_DIR = Path(__file__).resolve().parent / "jobs"

JobState = Literal["uploaded", "queued", "processing", "complete", "failed"]


@dataclass(slots=True)
class JobRecord:
    job_id: str
    state: JobState
    progress: int
    status: str
    created_at: str
    updated_at: str
    input_filename: str
    input_path: str
    file_size: int
    duration: float | None = None
    device: str = "cpu"
    elapsed_seconds: float = 0.0
    processing_speed: float | None = None
    error: str | None = None
    outputs: dict[str, str] = field(default_factory=dict)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_environment() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError("FFmpeg and FFprobe must be installed and available on PATH.")


def selected_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def validate_upload(filename: str, size: int) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Unsupported file type. Please upload one of: {allowed}.")
    if size > MAX_UPLOAD_BYTES:
        raise ValueError("File is larger than the 200 MB upload limit.")


def create_job(filename: str, size: int) -> JobRecord:
    job_id = str(uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    input_path = job_dir / f"original{Path(filename).suffix.lower()}"
    now = utc_now()
    return JobRecord(
        job_id=job_id,
        state="uploaded",
        progress=5,
        status="Upload received",
        created_at=now,
        updated_at=now,
        input_filename=filename,
        input_path=str(input_path),
        file_size=size,
        device=selected_device(),
    )


def job_dir(job_id: str) -> Path:
    return JOBS_DIR / job_id


def metadata_path(job_id: str) -> Path:
    return job_dir(job_id) / "job.json"


def save_job(job: JobRecord) -> None:
    path = metadata_path(job.job_id)
    temp_path = path.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(asdict(job), indent=2), encoding="utf-8")
    temp_path.replace(path)


def load_job(job_id: str) -> JobRecord:
    path = metadata_path(job_id)
    if not path.exists():
        raise FileNotFoundError("Job not found.")
    return JobRecord(**json.loads(path.read_text(encoding="utf-8")))


def update_job(job: JobRecord, **changes: object) -> JobRecord:
    for key, value in changes.items():
        setattr(job, key, value)
    job.updated_at = utc_now()
    save_job(job)
    return job


def run_command(command: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    logger.info("Running command: %s", " ".join(command))
    return subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        check=True,
        capture_output=True,
        text=True,
    )


def get_audio_duration(path: Path) -> float | None:
    try:
        result = run_command(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
        )
        return round(float(result.stdout.strip()), 2)
    except Exception:
        logger.exception("Unable to read duration for %s", path)
        return None


def create_zip(job_id: str, output_files: dict[str, str]) -> Path:
    zip_path = job_dir(job_id) / "stems.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for filename, path in output_files.items():
            archive.write(path, arcname=filename)
    return zip_path


async def cleanup_job_later(job_id: str, delay_seconds: int = 3600) -> None:
    await asyncio.sleep(delay_seconds)
    target = job_dir(job_id)
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)
        logger.info("Cleaned up job %s", job_id)
