# BG Remover App

A full-stack web application for batch background removal from images. Upload multiple product photos, choose between two AI segmentation modes, pick a background color, and fine-tune each result's position and zoom before downloading — all for free, with no external API costs.

## Features

- **Batch processing** — upload and process multiple images at once
- **Dual segmentation mode** — switch between a model optimized for standalone products and one optimized for shots including hands/models
- **Custom background color** — preset colors or a full color picker
- **Interactive editor** — drag to reposition and zoom each product image independently of its background, directly in the browser
- **Consistent output size** — all results are standardized to 1080x1080px
- **Fully self-hosted** — no paid third-party APIs; background removal runs locally via `rembg`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, HTML5 Canvas |
| Backend | Node.js, Express, Sharp |
| AI Service | Python, FastAPI, rembg (U²-Net) |
| Containerization | Docker, Docker Compose |

## Architecture
```text
┌──────────────┐      ┌───────────────┐      ┌────────────────────┐
│   Frontend   │ ───▶ │    Backend    │ ───▶ │  BG Removal Service │
│   (React)    │ ◀─── │ (Node/Express)│ ◀─── │   (Python/FastAPI)  │
└──────────────┘      └───────────────┘      └────────────────────┘
     :5173                  :3000                    :8000
```


The frontend uploads images to the Node backend, which forwards them to the Python microservice for AI-based background removal. The resulting transparent image is resized and returned to the frontend, where background color compositing and position/zoom editing happen entirely client-side using the Canvas API.

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Run with Docker (recommended)

```bash
git clone https://github.com/BRandyMedina/bg-remover-app.git
cd bg-remover-app
docker compose up --build
```

Once all three services are running, open:
http://localhost:5173


### Run manually (without Docker)

Each service needs to run in its own terminal.

**1. AI service (Python)**
```bash
cd bg-removal-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**2. Backend (Node)**
```bash
cd backend
npm install
node server.js
```

**3. Frontend (React)**
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Select an image type: **Product** (standalone item) or **Model** (item worn/held by a person)
2. Choose a background color from the presets or the custom color picker
3. Drag and drop (or select) one or more images
4. Click **Process**
5. Click **Edit** on any result to reposition or zoom the product within the frame
6. Click **Download** to save the final image

## Project Structure

```text
bg-remover-app/
├── bg-removal-service/   # Python microservice (rembg)
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── backend/              # Node/Express API
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/             # React app
│   ├── src/
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```


## API Reference

### `POST /remove-bg` (Python service)
Removes the background from a single image.

| Field | Type | Description |
|---|---|---|
| `file` | File | Image to process |
| `mode` | string | `"product"` or `"model"` |

### `POST /process-images` (Node backend)
Processes one or more images: calls the AI service and resizes the result to 1080x1080.

| Field | Type | Description |
|---|---|---|
| `images` | File[] | One or more images |
| `mode` | string | `"product"` or `"model"` |

## Known Limitations

- Loose clothing near the edited subject (e.g. a sleeve) may not always be separated from the person in "model" mode
- Very large batches may be slow on machines with limited RAM, since background removal runs on CPU

## Future Improvements

- ZIP download for multiple selected results
- Deployment to a public hosting provider

## Author

Built by Brandy Medina Cadena as a personal project.