<div align="center">
  <img src="assets/banner.svg" alt="CGPA Path Explorer. The exact probability distribution of your semester CGPA, every grade path convolved." width="100%"/>
</div>

<div align="center">
  <img src="https://img.shields.io/badge/node-18+-A8D4FF?style=flat-square&labelColor=0A0B0E&logo=nodedotjs&logoColor=EEF1ED" alt="node 18+"/>
  <img src="https://img.shields.io/github/last-commit/Madmins07/cgpa_simulator?style=flat-square&labelColor=0A0B0E&color=6A7280&label=updated" alt="last-commit"/>
  <img src="https://img.shields.io/github/license/Madmins07/cgpa_simulator?style=flat-square&labelColor=0A0B0E&color=2A2F39" alt="license"/>
  <a href="https://cgpa-simulator-omega.vercel.app"><img src="https://img.shields.io/badge/live-cgpa--simulator--omega.vercel.app-F4F5F7?style=flat-square&labelColor=0A0B0E" alt="live cgpa--simulator--omega.vercel.app"/></a>
</div>

## about

Every student at Kharagpur has asked the same question the week before grades drop: *what do I need this semester?*
This app answers it properly. You give each course a credit weight and a probability for every grade from EX to F,
and the backend **convolves those distributions over every possible grade path**. The result is the exact probability
distribution of your semester CGPA. A Monte Carlo run (default 25,000 trials) sits alongside it so you can see the
simulated mean converge on the exact one.

- Expected CGPA, standard deviation, median, P10 / P25 / P75 / P90, best and worst case.
- Probability of clearing a target CGPA.
- Histogram, cumulative distribution curve, and per-course grade bars.
- Probability sliders auto-rebalance so each course always sums to 100%.

## stack

| part | what |
|:--|:--|
| `frontend/` | React 18 + Vite, Recharts for the charts, lucide icons. |
| `backend/` | Express API with helmet and rate limiting; `src/simulation.js` holds the convolution engine. |
| `docker-compose.yml` | Two containers, nginx in front of the frontend proxying `/api` to the backend. |

## run

```bash
npm run install:all      # installs backend and frontend
npm run dev:backend      # http://localhost:5001 (5000 is AirPlay on macOS)
npm run dev:frontend     # http://localhost:3000, proxies /api to the backend
```

With Docker:

```bash
docker compose up --build
# frontend on :3000, backend on :5050
```

## api

`POST /api/simulate`

```json
{
  "targetCgpa": 8.0,
  "courses": [
    { "name": "Mathematics", "credits": 4,
      "probabilities": { "EX": 0.1, "A": 0.2, "B": 0.3, "C": 0.2, "D": 0.1, "P": 0.1, "F": 0.0 } }
  ]
}
```

Returns `summary` (statistics and path counts), `distribution` (bucketed chart data), `exactDistribution`
(every reachable CGPA state), `gradeBreakdown` and `courseStats`.

`GET /api/grades` returns the grade order and grade-point map. `GET /health` is the health check.

## how the maths works

For each course, the grade points times credits form a discrete random variable. The semester total is the sum of
independent course variables, so its distribution is the convolution of theirs. The engine walks the courses once,
keeping a map from reachable credit-point totals to their probabilities, which is exact and runs in milliseconds
even for a full semester.

---

<div align="center">
  <sub>Part of <a href="https://github.com/Madmins07">Madmins07</a> · Madhav Agarwal · IIT Kharagpur</sub>
</div>
