# AI Vocal & Instrument Separator

A modern full-stack vocal and instrumental separator powered by Demucs HTDemucs.

## Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion, Axios
- Backend: FastAPI, Demucs, FFmpeg, PyTorch, Uvicorn

## Requirements

- Python 3.10+
- Node.js 18+
- FFmpeg available on `PATH`
- CUDA-capable PyTorch install for GPU acceleration, otherwise CPU is used

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend writes job data to `backend/jobs/{uuid}` and automatically removes completed or failed jobs after one hour.

For deployment, set:

```bash
FRONTEND_ORIGINS=https://your-frontend-domain.vercel.app
```

The backend Dockerfile installs FFmpeg and starts FastAPI with the platform-provided `PORT`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` only if you want the browser to call a different backend directly.

For production frontend hosting, set:

```bash
VITE_API_BASE_URL=https://your-backend-domain.com
```

## API

- `POST /upload` uploads an audio file and returns a `job_id`
- `POST /separate` starts separation for a job
- `GET /status/{job_id}` returns processing state
- `GET /download/{job_id}/{filename}` downloads one output file
- `GET /download/{job_id}/zip` downloads all outputs as a ZIP

## Outputs

Each job produces:

- `vocals.wav`
- `bass.wav`
- `drums.wav`
- `other.wav`
- `instrumental.wav`
- `stems.zip`
