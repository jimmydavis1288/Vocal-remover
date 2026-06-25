from __future__ import annotations

import logging
import shutil
import subprocess
import sys
import time
from pathlib import Path

from utils import JobRecord, create_zip, job_dir, run_command, update_job

logger = logging.getLogger("separator")


def _copy_stem(source: Path, target: Path) -> None:
    if not source.exists():
        raise RuntimeError(f"Expected Demucs output was not created: {source.name}")
    shutil.copy2(source, target)


def _combine_instrumental(bass: Path, drums: Path, other: Path, output: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(bass),
        "-i",
        str(drums),
        "-i",
        str(other),
        "-filter_complex",
        "amix=inputs=3:duration=longest:normalize=0",
        "-c:a",
        "pcm_s16le",
        str(output),
    ]
    run_command(command)


def separate_job(job: JobRecord) -> JobRecord:
    started = time.perf_counter()
    root = job_dir(job.job_id)
    demucs_out = root / "demucs"
    outputs_dir = root / "outputs"
    outputs_dir.mkdir(exist_ok=True)

    try:
        update_job(job, state="processing", progress=15, status="Loading AI model...")

        input_path = Path(job.input_path)
        command = [
            sys.executable,
            "-m",
            "demucs.separate",
            "-n",
            "htdemucs",
            "--device",
            job.device,
            "--segment",
            "7",
            "-j",
            "1",
            "--out",
            str(demucs_out),
            str(input_path),
        ]

        update_job(job, progress=35, status="Separating stems...")
        try:
            run_command(command)
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr[-1200:] if exc.stderr else "Demucs failed without stderr output."
            raise RuntimeError(stderr) from exc

        update_job(job, progress=75, status="Creating instrumental...")
        track_dir = demucs_out / "htdemucs" / input_path.stem
        stem_paths = {
            "vocals.wav": outputs_dir / "vocals.wav",
            "bass.wav": outputs_dir / "bass.wav",
            "drums.wav": outputs_dir / "drums.wav",
            "other.wav": outputs_dir / "other.wav",
        }
        for filename, target in stem_paths.items():
            _copy_stem(track_dir / filename, target)

        instrumental = outputs_dir / "instrumental.wav"
        _combine_instrumental(
            stem_paths["bass.wav"],
            stem_paths["drums.wav"],
            stem_paths["other.wav"],
            instrumental,
        )

        update_job(job, progress=92, status="Saving files...")
        downloadable = {
            "vocals.wav": str(stem_paths["vocals.wav"]),
            "bass.wav": str(stem_paths["bass.wav"]),
            "drums.wav": str(stem_paths["drums.wav"]),
            "other.wav": str(stem_paths["other.wav"]),
            "instrumental.wav": str(instrumental),
        }
        zip_path = create_zip(job.job_id, downloadable)
        downloadable["stems.zip"] = str(zip_path)

        elapsed = round(time.perf_counter() - started, 2)
        speed = round((job.duration or 0) / elapsed, 2) if elapsed > 0 and job.duration else None
        return update_job(
            job,
            state="complete",
            progress=100,
            status="Complete",
            elapsed_seconds=elapsed,
            processing_speed=speed,
            outputs=downloadable,
        )
    except RuntimeError as exc:
        logger.exception("Separation failed for job %s", job.job_id)
        return update_job(
            job,
            state="failed",
            progress=100,
            status="Something went wrong during separation.",
            error=str(exc),
        )
    except Exception as exc:
        logger.exception("Unexpected separation failure for job %s", job.job_id)
        return update_job(
            job,
            state="failed",
            progress=100,
            status="The AI engine could not finish this file.",
            error=str(exc),
        )
