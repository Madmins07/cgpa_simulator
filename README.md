# CGPA Path Explorer

Full-stack semester CGPA estimator that evaluates **all possible grade paths** from your per-course grade probabilities.

Grades supported: **EX, A, B, C, D, P, F**

---

## Features

- Exact probabilistic simulation using backend convolution (not random Monte Carlo trials).
- Course-wise credit input (integer credits, minimum 1).
- Probability sliders for each grade (auto-rebalanced to always sum to 100%).
- Statistical outputs:
  - Expected CGPA
  - Standard deviation
  - Median, P10, P25, P75, P90
  - Best/worst possible CGPA
  - Number of evaluated paths and distinct outcome states
  - Probability of achieving target CGPA
- Graphs:
  - CGPA probability histogram
  - Cumulative distribution curve (CDF)
  - Per-course grade probability bars

---

## Repo Structure

```text
dukh/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── simulation.js
│   │   └── routes/simulate.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
└── package.json
```

---

## Local Development

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Start backend

```bash
npm run dev:backend
```

Backend runs on `http://localhost:5000`.

### 3. Start frontend

In another terminal:

```bash
npm run dev:frontend
```

Frontend runs on `http://localhost:3000` and proxies `/api` to backend.

---

## Docker Deployment

```bash
docker-compose up --build
```

- Frontend: `http://localhost:3000`
- Backend (direct): `http://localhost:5050`
- Frontend calls backend through nginx `/api` proxy.

---

## API

### `POST /api/simulate`

Request:

```json
{
  "targetCgpa": 8.0,
  "courses": [
    {
      "name": "Mathematics",
      "credits": 4,
      "probabilities": {
        "EX": 0.1,
        "A": 0.2,
        "B": 0.3,
        "C": 0.2,
        "D": 0.1,
        "P": 0.1,
        "F": 0.0
      }
    }
  ]
}
```

Response includes:
- `summary` (stats + path counts)
- `distribution` (bucketed chart data)
- `exactDistribution` (all exact CGPA states)
- `gradeBreakdown` and `courseStats`

### `GET /api/grades`
Returns grade order and grade-point map.

### `GET /health`
Backend health endpoint.
