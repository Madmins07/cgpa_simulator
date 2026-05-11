import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Settings,
  Plus,
  Trash2,
  PlayCircle,
  RotateCcw,
  Download,
  Copy,
  TrendingUp,
  BookOpen,
  Zap,
  ArrowRight,
  Sparkles,
  Target,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react'

const GRADES = ['EX', 'A', 'B', 'C', 'D', 'P', 'F']
const STEP = 0.25
const TOTAL_UNITS = Math.round(1 / STEP)
const GRADE_POINTS = { EX: 10, A: 9, B: 8, C: 7, D: 6, P: 5, F: 0 }
const GRADE_COLORS = {
  EX: '#06b6d4',
  A: '#10b981',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  P: '#f43f5e',
  F: '#ef4444',
}
const STARTING_PROBABILITIES = { EX: 0, A: 0, B: 0, C: 0, D: 0, P: 0, F: 0 }
const DEFAULT_TRIALS = 25000
const DEFAULT_REVIEW = { difficulty: 3, workload: 3, grading: 3, attendance: 3 }

const PRESET_DISTRIBUTIONS = {
  'Likely Pass': { EX: 0, A: 0, B: 0.25, C: 0.5, D: 0.25, P: 0, F: 0 },
  'Confident': { EX: 0.25, A: 0.5, B: 0.25, C: 0, D: 0, P: 0, F: 0 },
  'Balanced': { EX: 0.25, A: 0.25, B: 0.25, C: 0.25, D: 0, P: 0, F: 0 },
  'Risky': { EX: 0.5, A: 0.25, B: 0.25, C: 0, D: 0, P: 0, F: 0 },
}

const GOAL_MODES = [
  { label: 'Target 7.5+', value: 7.5 },
  { label: 'Target 8.0+', value: 8.0 },
  { label: 'Target 8.5+', value: 8.5 },
  { label: 'Target 9.0+', value: 9.0 },
]

const STRATEGY_PRESETS = {
  Conservative: {
    description: 'Stable outcomes, reduced downside risk.',
    distribution: { EX: 0, A: 0.25, B: 0.5, C: 0.25, D: 0, P: 0, F: 0 },
  },
  Realistic: {
    description: 'Balanced outcomes with moderate stretch.',
    distribution: { EX: 0.25, A: 0.25, B: 0.25, C: 0.25, D: 0, P: 0, F: 0 },
  },
  Aggressive: {
    description: 'Higher upside with concentrated top grades.',
    distribution: { EX: 0.5, A: 0.25, B: 0.25, C: 0, D: 0, P: 0, F: 0 },
  },
}

function createCourse(id) {
  return {
    id,
    name: `Course ${id}`,
    credits: 3,
    probabilities: { ...STARTING_PROBABILITIES },
  }
}

const INITIAL_COURSES = [createCourse(1), createCourse(2), createCourse(3)]

function sumProbabilities(probabilities) {
  return GRADES.reduce((acc, grade) => acc + Number(probabilities[grade] || 0), 0)
}

function toUnits(value) {
  return Math.max(0, Math.min(TOTAL_UNITS, Math.round((value || 0) / STEP)))
}

function fromUnits(units) {
  return Math.max(0, Math.min(TOTAL_UNITS, units)) * STEP
}

function buildUnitsMap(probabilities) {
  const units = {}
  GRADES.forEach((grade) => {
    units[grade] = toUnits(probabilities[grade])
  })
  return units
}

function sumUnits(unitsMap) {
  return GRADES.reduce((acc, grade) => acc + (unitsMap[grade] || 0), 0)
}

function maxUnitsForGrade(probabilities, grade) {
  const units = buildUnitsMap(probabilities)
  const totalUnits = sumUnits(units)
  const current = units[grade] || 0
  return Math.max(0, Math.min(TOTAL_UNITS, TOTAL_UNITS - (totalUnits - current)))
}

function unitsToProbabilities(unitsMap) {
  const probabilities = {}
  GRADES.forEach((grade) => {
    probabilities[grade] = fromUnits(unitsMap[grade] || 0)
  })
  return probabilities
}

function expectedGradePoint(probabilities) {
  return GRADES.reduce((sum, grade) => sum + (probabilities[grade] || 0) * GRADE_POINTS[grade], 0)
}

function defaultReview() {
  return { ...DEFAULT_REVIEW }
}

function buildInitialReviews(courses) {
  return courses.reduce((acc, course) => {
    acc[course.id] = defaultReview()
    return acc
  }, {})
}

function suggestDistributionForTarget(targetCgpa) {
  const clampedTarget = Math.min(10, Math.max(0, Number(targetCgpa) || 0))
  let best = { score: Infinity, units: null }

  for (let ex = 0; ex <= TOTAL_UNITS; ex += 1) {
    for (let a = 0; a <= TOTAL_UNITS - ex; a += 1) {
      for (let b = 0; b <= TOTAL_UNITS - ex - a; b += 1) {
        for (let c = 0; c <= TOTAL_UNITS - ex - a - b; c += 1) {
          for (let d = 0; d <= TOTAL_UNITS - ex - a - b - c; d += 1) {
            for (let p = 0; p <= TOTAL_UNITS - ex - a - b - c - d; p += 1) {
              const f = TOTAL_UNITS - ex - a - b - c - d - p
              const expected = (
                ex * GRADE_POINTS.EX
                + a * GRADE_POINTS.A
                + b * GRADE_POINTS.B
                + c * GRADE_POINTS.C
                + d * GRADE_POINTS.D
                + p * GRADE_POINTS.P
                + f * GRADE_POINTS.F
              ) / TOTAL_UNITS
              const shortfallPenalty = expected < clampedTarget ? (clampedTarget - expected) * 2 : 0
              const score = Math.abs(expected - clampedTarget) + shortfallPenalty
              if (score < best.score) {
                best = { score, units: { EX: ex, A: a, B: b, C: c, D: d, P: p, F: f } }
              }
            }
          }
        }
      }
    }
  }

  return unitsToProbabilities(best.units || buildUnitsMap(STARTING_PROBABILITIES))
}

function statCard(icon, label, value, highlight = false) {
  return (
    <div className={`stat-card ${highlight ? 'highlight' : ''}`} key={label}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  )
}

function GradeAllocator({ course, onAdjust, autoBalance, onFillRemaining, onEqualize }) {
  const unitsMap = buildUnitsMap(course.probabilities)
  const totalUnits = sumUnits(unitsMap)
  const remainingUnits = Math.max(0, TOTAL_UNITS - totalUnits)
  const isValid = remainingUnits === 0

  return (
    <div className="grade-allocator">
      <div className="allocator-title">
        <span>Grade Distribution</span>
        <div className="allocator-meta">
          <span className="remaining-badge">Remaining {(remainingUnits * STEP).toFixed(2)}</span>
          <span className={`total-badge ${isValid ? 'valid' : 'invalid'}`}>
            Total {(totalUnits * STEP).toFixed(2)}
          </span>
        </div>
      </div>
      <div className="grade-row">
        {GRADES.map((grade) => (
          <div key={grade} className="grade-chip">
            <span className="grade-tag" style={{ backgroundColor: GRADE_COLORS[grade] }}>
              {grade}
            </span>
            <div className="stepper">
              <button
                type="button"
                className="step-btn"
                onClick={() => onAdjust(course.id, grade, -1)}
                disabled={unitsMap[grade] === 0}
                aria-label={`Decrease ${grade}`}
              >
                -
              </button>
              <span className="step-value">{Math.round(unitsMap[grade] * STEP * 100)}%</span>
              <button
                type="button"
                className="step-btn"
                onClick={() => onAdjust(course.id, grade, 1)}
                disabled={autoBalance ? unitsMap[grade] >= TOTAL_UNITS : unitsMap[grade] >= maxUnitsForGrade(course.probabilities, grade)}
                aria-label={`Increase ${grade}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="distribution-bar">
        {GRADES.map((grade) => {
          const width = unitsMap[grade] * STEP * 100
          if (width <= 0) return null
          return (
            <span
              key={grade}
              className="bar-segment"
              style={{ width: `${width}%`, backgroundColor: GRADE_COLORS[grade] }}
            />
          )
        })}
      </div>
      <div className={`allocator-foot ${isValid ? 'valid' : ''}`}>
        <span>Remaining {(remainingUnits * STEP).toFixed(2)}</span>
        <span>{isValid ? 'Ready to simulate' : 'Fill to 1.00 to run'}</span>
      </div>
      <div className="allocator-actions">
        <button type="button" className="action-link" onClick={() => onFillRemaining(course.id)}>
          Fill remaining
        </button>
        <button type="button" className="action-link" onClick={() => onEqualize(course.id)}>
          Equalize
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [courses, setCourses] = useState(INITIAL_COURSES)
  const [simulatorTab, setSimulatorTab] = useState('goal')
  const [nextId, setNextId] = useState(4)
  const [targetCgpa, setTargetCgpa] = useState(8.0)
  const [numTrials, setNumTrials] = useState(DEFAULT_TRIALS)
  const [apiBaseUrl, setApiBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || '')
  const [showSettings, setShowSettings] = useState(false)
  const [showPresets, setShowPresets] = useState({})
  const [expandedCourses, setExpandedCourses] = useState({ 1: true })
  const [courseReviews, setCourseReviews] = useState(() => buildInitialReviews(INITIAL_COURSES))
  const [autoBalance, setAutoBalance] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const totalCredits = useMemo(
    () => courses.reduce((sum, course) => sum + Number(course.credits || 0), 0),
    [courses],
  )

  const distributionForCdf = useMemo(() => {
    if (!result?.distribution) return []
    let cumulative = 0
    return result.distribution.map((point) => {
      cumulative += point.probability
      return { ...point, cumulative: Number(cumulative.toFixed(3)) }
    })
  }, [result])

  const reviewAverages = useMemo(() => {
    if (courses.length === 0) return defaultReview()
    const totals = courses.reduce((acc, course) => {
      const review = courseReviews[course.id] || DEFAULT_REVIEW
      acc.difficulty += Number(review.difficulty || 0)
      acc.workload += Number(review.workload || 0)
      acc.grading += Number(review.grading || 0)
      acc.attendance += Number(review.attendance || 0)
      return acc
    }, { difficulty: 0, workload: 0, grading: 0, attendance: 0 })

    return {
      difficulty: (totals.difficulty / courses.length).toFixed(1),
      workload: (totals.workload / courses.length).toFixed(1),
      grading: (totals.grading / courses.length).toFixed(1),
      attendance: (totals.attendance / courses.length).toFixed(1),
    }
  }, [courseReviews, courses])

  const suggestedForTarget = useMemo(
    () => suggestDistributionForTarget(Number(targetCgpa)),
    [targetCgpa],
  )

  const updateCourse = (courseId, patch) => {
    setCourses((prev) => prev.map((course) => (course.id === courseId ? { ...course, ...patch } : course)))
  }

  const adjustProbability = (courseId, grade, deltaUnits) => {
    setCourses((prev) => prev.map((course) => {
      if (course.id !== courseId) return course
      const unitsMap = buildUnitsMap(course.probabilities)
      const maxUnits = autoBalance ? TOTAL_UNITS : maxUnitsForGrade(course.probabilities, grade)
      const nextUnits = Math.max(0, Math.min(unitsMap[grade] + deltaUnits, maxUnits))
      unitsMap[grade] = nextUnits

      if (autoBalance) {
        let totalUnits = sumUnits(unitsMap)
        if (totalUnits > TOTAL_UNITS) {
          let over = totalUnits - TOTAL_UNITS
          const others = GRADES.filter((g) => g !== grade)
          while (over > 0) {
            const candidate = others.reduce((maxG, g) => (unitsMap[g] > unitsMap[maxG] ? g : maxG), others[0])
            if (unitsMap[candidate] === 0) break
            unitsMap[candidate] -= 1
            over -= 1
          }
          if (over > 0) {
            unitsMap[grade] = Math.max(0, unitsMap[grade] - over)
          }
        } else if (totalUnits < TOTAL_UNITS) {
          let remaining = TOTAL_UNITS - totalUnits
          const others = GRADES.filter((g) => g !== grade)
          const pool = others.length ? others : [grade]
          while (remaining > 0) {
            const candidate = pool.reduce((minG, g) => (unitsMap[g] < unitsMap[minG] ? g : minG), pool[0])
            unitsMap[candidate] += 1
            remaining -= 1
          }
        }
      }

      return {
        ...course,
        probabilities: unitsToProbabilities(unitsMap),
      }
    }))
  }

  const fillRemaining = (courseId) => {
    setCourses((prev) => prev.map((course) => {
      if (course.id !== courseId) return course
      const unitsMap = buildUnitsMap(course.probabilities)
      let remaining = TOTAL_UNITS - sumUnits(unitsMap)
      if (remaining <= 0) return course
      const pool = GRADES.slice()
      while (remaining > 0) {
        const candidate = pool.reduce((minG, g) => (unitsMap[g] < unitsMap[minG] ? g : minG), pool[0])
        unitsMap[candidate] += 1
        remaining -= 1
      }
      return { ...course, probabilities: unitsToProbabilities(unitsMap) }
    }))
  }

  const equalizeCourse = (courseId) => {
    setCourses((prev) => prev.map((course) => {
      if (course.id !== courseId) return course
      const unitsMap = GRADES.reduce((acc, grade) => ({ ...acc, [grade]: 0 }), {})
      const active = GRADES.filter((grade) => course.probabilities[grade] > 0)
      const targets = active.length > 0 ? active : ['EX', 'A', 'B', 'C']
      const base = Math.floor(TOTAL_UNITS / targets.length)
      let remainder = TOTAL_UNITS - base * targets.length
      targets.forEach((grade) => {
        unitsMap[grade] = base + (remainder > 0 ? 1 : 0)
        remainder -= 1
      })
      return { ...course, probabilities: unitsToProbabilities(unitsMap) }
    }))
  }

  const applyPreset = (courseId, presetName) => {
    setCourses((prev) => prev.map((course) => {
      if (course.id !== courseId) return course
      return {
        ...course,
        probabilities: { ...PRESET_DISTRIBUTIONS[presetName] },
      }
    }))
    setShowPresets((prev) => ({ ...prev, [courseId]: false }))
  }

  const applyDistributionToAllCourses = (distribution) => {
    setCourses((prev) => prev.map((course) => ({
      ...course,
      probabilities: { ...distribution },
    })))
    setError('')
  }

  const applyGoalSuggestion = () => {
    const suggestion = suggestDistributionForTarget(Number(targetCgpa))
    applyDistributionToAllCourses(suggestion)
  }

  const applyStrategyPreset = (name) => {
    const preset = STRATEGY_PRESETS[name]
    if (!preset) return
    applyDistributionToAllCourses(preset.distribution)
  }

  const updateCourseReview = (courseId, field, value) => {
    setCourseReviews((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || defaultReview()),
        [field]: Number(value),
      },
    }))
  }

  const addCourse = () => {
    if (courses.length >= 20) {
      setError('Maximum 20 courses are allowed.')
      return
    }
    setCourses((prev) => [...prev, createCourse(nextId)])
    setNextId((id) => id + 1)
    setExpandedCourses((prev) => ({ ...prev, [nextId]: false }))
    setCourseReviews((prev) => ({ ...prev, [nextId]: defaultReview() }))
  }

  const removeCourse = (courseId) => {
    if (courses.length === 1) return
    setCourses((prev) => prev.filter((c) => c.id !== courseId))
    setCourseReviews((prev) => {
      const next = { ...prev }
      delete next[courseId]
      return next
    })
  }

  const resetCourses = () => {
    setCourses(INITIAL_COURSES.map((course) => ({ ...course, probabilities: { ...course.probabilities } })))
    setCourseReviews(buildInitialReviews(INITIAL_COURSES))
    setNextId(4)
    setResult(null)
    setError('')
  }

  const runSimulation = async () => {
    setError('')
    setResult(null)

    if (courses.length === 0) {
      setError('Please add at least one course.')
      return
    }
    if (courses.some((c) => !Number.isInteger(Number(c.credits)) || Number(c.credits) < 1)) {
      setError('Each course must have integer credits (minimum 1).')
      return
    }

    const invalid = courses.find((c) => {
      const sum = GRADES.reduce((acc, g) => acc + Number(c.probabilities[g]), 0)
      return Math.abs(sum - 1) > 1e-9
    })
    if (invalid) {
      setError(`"${invalid.name}": probabilities must total 1.00.`)
      return
    }

    const parsedTrials = Number(numTrials)
    const clampedTrials = Number.isFinite(parsedTrials)
      ? Math.min(Math.max(Math.round(parsedTrials), 1000), 200000)
      : DEFAULT_TRIALS

    setLoading(true)
    try {
      const payload = {
        targetCgpa: Number(targetCgpa),
        numTrials: clampedTrials,
        courses: courses.map((c) => ({
          name: c.name.trim() || `Course ${c.id}`,
          credits: Number(c.credits),
          probabilities: Object.fromEntries(GRADES.map((g) => [g, Number(c.probabilities[g])])),
        })),
      }

      const res = await fetch(`${apiBaseUrl}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Simulation failed')
      }
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const exportAsCSV = () => {
    if (!result) return
    let csv = 'CGPA Simulation Results\n'
    csv += `Exact Expected CGPA,${result.summary.expectedCGPA}\n`
    csv += `Simulated Mean (n=${result.summary.numTrials}),${result.summary.simulatedMean}\n`
    csv += `Std Dev (Exact),${result.summary.stdDev}\n`
    csv += `Median,${result.summary.median}\n`
    csv += `P10,${result.summary.p10}\n`
    csv += `P90,${result.summary.p90}\n`
    csv += `Best,${result.summary.best}\n`
    csv += `Worst,${result.summary.worst}\n`
    csv += '\nDistribution\n'
    csv += result.distribution.map((row) => `${row.cgpa},${row.probability}`).join('\n')

    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `cgpa-simulation-${Date.now()}.csv`
    link.click()
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <TrendingUp className="logo-icon" />
            <div>
              <h1>CGPA Path Explorer</h1>
              <p>Exact outcome modeling for semester planning</p>
            </div>
          </div>
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${page === 'home' ? 'active' : ''}`}
              onClick={() => setPage('home')}
            >
              Home
            </button>
            <button
              className={`nav-tab ${page === 'simulator' ? 'active' : ''}`}
              onClick={() => setPage('simulator')}
            >
              Simulator
            </button>
          </nav>
          {page === 'simulator' && (
            <button
              className="header-btn"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={18} />
              Settings
            </button>
          )}
        </div>

        {showSettings && page === 'simulator' && (
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
        )}
        {showSettings && page === 'simulator' && (
          <div className="settings-panel">
            <h3>Simulation Settings</h3>
            <label>
              Target CGPA
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={targetCgpa}
                onChange={(e) => setTargetCgpa(e.target.value)}
              />
            </label>
            <label>
              Monte Carlo Trials (for simulated mean)
              <input
                type="number"
                min="1000"
                max="200000"
                step="1000"
                value={numTrials}
                onChange={(e) => setNumTrials(e.target.value)}
              />
            </label>
            <label className="toggle-row">
              Auto-balance to 1.00
              <input
                type="checkbox"
                checked={autoBalance}
                onChange={(e) => setAutoBalance(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-thumb" />
              </span>
            </label>
            <label>
              API Base URL
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="Leave empty for same-origin"
              />
            </label>
          </div>
        )}
      </header>

      {page === 'home' ? (
        <main className="home">
          <section className="home-hero">
            <div>
              <p className="home-badge">
                <Sparkles size={14} /> Precision CGPA Planner
              </p>
              <h2>Forecast every possible semester outcome with confidence.</h2>
              <p>
                Configure course credits and grade probabilities, then evaluate all possible
                grade paths exactly. Track your target CGPA and export results instantly.
              </p>
              <div className="home-actions">
                <button className="primary" onClick={() => setPage('simulator')}>
                  Open Simulator <ArrowRight size={16} />
                </button>
                <button className="ghost" onClick={() => setPage('simulator')}>
                  View Demo
                </button>
              </div>
            </div>
            <div className="home-card">
              <div className="metric">
                <span>Exact Paths</span>
                <strong>100%</strong>
              </div>
              <div className="metric">
                <span>Probability Step</span>
                <strong>0.25</strong>
              </div>
              <div className="metric">
                <span>Max Courses</span>
                <strong>20</strong>
              </div>
            </div>
          </section>

          <section className="home-grid">
            <div className="home-feature">
              <Zap size={22} />
              <h3>Scenario Presets</h3>
              <p>Apply quick probability profiles and iterate faster.</p>
            </div>
            <div className="home-feature">
              <TrendingUp size={22} />
              <h3>Target Tracking</h3>
              <p>See the probability of hitting your desired CGPA instantly.</p>
            </div>
            <div className="home-feature">
              <BookOpen size={22} />
              <h3>Course Insights</h3>
              <p>Inspect per-course expected grade points and distributions.</p>
            </div>
          </section>
        </main>
      ) : (
        <main className="app-main">
          <section className="sidebar">
            <div className="community-tools">
              <div className="community-tabs">
                <button
                  className={`community-tab ${simulatorTab === 'goal' ? 'active' : ''}`}
                  onClick={() => setSimulatorTab('goal')}
                >
                  <Target size={14} /> Goal Modes
                </button>
                <button
                  className={`community-tab ${simulatorTab === 'strategy' ? 'active' : ''}`}
                  onClick={() => setSimulatorTab('strategy')}
                >
                  <ShieldCheck size={14} /> What-if Presets
                </button>
                <button
                  className={`community-tab ${simulatorTab === 'review' ? 'active' : ''}`}
                  onClick={() => setSimulatorTab('review')}
                >
                  <ClipboardList size={14} /> Course Reviews
                </button>
              </div>

              <div className="community-panel">
                {simulatorTab === 'goal' && (
                  <div className="goal-mode-panel">
                    <p className="panel-label">Choose target mode</p>
                    <div className="goal-mode-buttons">
                      {GOAL_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          className={`goal-mode-btn ${Number(targetCgpa) === mode.value ? 'active' : ''}`}
                          onClick={() => setTargetCgpa(mode.value)}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <p className="panel-label">Auto-suggested distribution for target {Number(targetCgpa).toFixed(2)}</p>
                    <div className="suggestion-chips">
                      {GRADES.map((grade) => (
                        <span key={grade} className="suggestion-chip">
                          <strong>{grade}</strong> {Math.round((suggestedForTarget[grade] || 0) * 100)}%
                        </span>
                      ))}
                    </div>
                    <button className="community-action" onClick={applyGoalSuggestion}>
                      Apply Suggested Distribution
                    </button>
                  </div>
                )}

                {simulatorTab === 'strategy' && (
                  <div className="strategy-panel">
                    {Object.entries(STRATEGY_PRESETS).map(([name, config]) => (
                      <div key={name} className="strategy-card">
                        <div>
                          <h4>{name}</h4>
                          <p>{config.description}</p>
                          <small>Expected GPA: {expectedGradePoint(config.distribution).toFixed(2)}</small>
                        </div>
                        <button className="community-action alt" onClick={() => applyStrategyPreset(name)}>
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {simulatorTab === 'review' && (
                  <div className="review-panel">
                    <div className="review-averages">
                      <span>Difficulty {reviewAverages.difficulty}/5</span>
                      <span>Workload {reviewAverages.workload}/5</span>
                      <span>Strictness {reviewAverages.grading}/5</span>
                      <span>Attendance {reviewAverages.attendance}/5</span>
                    </div>
                    <div className="review-list">
                      {courses.map((course) => {
                        const review = courseReviews[course.id] || DEFAULT_REVIEW
                        return (
                          <div key={`review-${course.id}`} className="review-item">
                            <p>{course.name}</p>
                            <div className="review-fields">
                              <label>
                                Difficulty
                                <select
                                  value={review.difficulty}
                                  onChange={(e) => updateCourseReview(course.id, 'difficulty', e.target.value)}
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Workload
                                <select
                                  value={review.workload}
                                  onChange={(e) => updateCourseReview(course.id, 'workload', e.target.value)}
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Grading
                                <select
                                  value={review.grading}
                                  onChange={(e) => updateCourseReview(course.id, 'grading', e.target.value)}
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Attendance
                                <select
                                  value={review.attendance}
                                  onChange={(e) => updateCourseReview(course.id, 'attendance', e.target.value)}
                                >
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar-header">
              <h2>Courses</h2>
              <div className="sidebar-actions">
                <button className="icon-btn" onClick={addCourse} title="Add course">
                  <Plus size={18} />
                </button>
                <button className="icon-btn" onClick={resetCourses} title="Reset all">
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            <div className="courses-list">
              {courses.map((course) => (
                <div className={`course-item ${expandedCourses[course.id] ? 'expanded' : 'collapsed'}`} key={course.id}>
                  <div className="course-header">
                    <div className="course-meta">
                      <input
                        type="text"
                        className="course-name"
                        value={course.name}
                        onChange={(e) => updateCourse(course.id, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        className="course-credits"
                        min="1"
                        step="1"
                        value={course.credits}
                        onChange={(e) => updateCourse(course.id, { credits: e.target.value })}
                        placeholder="Credits"
                      />
                    </div>
                    <div className="course-actions">
                      <button
                        className="course-toggle"
                        onClick={() => setExpandedCourses((prev) => ({
                          ...prev,
                          [course.id]: !prev[course.id],
                        }))}
                      >
                        {expandedCourses[course.id] ? 'Hide' : 'Edit'} Probabilities
                      </button>
                      <button
                        className="remove-course"
                        onClick={() => removeCourse(course.id)}
                        disabled={courses.length === 1}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>

                      {expandedCourses[course.id] ? (
                        <>
                          <GradeAllocator
                            course={course}
                            onAdjust={adjustProbability}
                            autoBalance={autoBalance}
                            onFillRemaining={fillRemaining}
                            onEqualize={equalizeCourse}
                          />
                          <div className="preset-buttons">
                        <button
                          className="preset-toggle"
                          onClick={() => setShowPresets((p) => ({ ...p, [course.id]: !p[course.id] }))}
                        >
                          <Zap size={14} /> Presets
                        </button>
                        {showPresets[course.id] && (
                          <div className="preset-menu">
                            {Object.keys(PRESET_DISTRIBUTIONS).map((name) => (
                              <button
                                key={name}
                                className="preset-item"
                                onClick={() => applyPreset(course.id, name)}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="course-summary-inline">
                      <span>Remaining: {(1 - sumProbabilities(course.probabilities)).toFixed(2)}</span>
                      <span className="course-summary-chip">Total {sumProbabilities(course.probabilities).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="course-summary">
              <div className="summary-row">
                <span>Total Credits:</span>
                <strong>{totalCredits}</strong>
              </div>
              <div className="summary-row">
                <span>Courses:</span>
                <strong>{courses.length} / 20</strong>
              </div>
              <div className="summary-row">
                <span>Trials:</span>
                <strong>{result?.summary?.numTrials || numTrials}</strong>
              </div>
            </div>

            <button
              className="simulate-btn"
              onClick={runSimulation}
              disabled={loading || courses.length === 0}
            >
              <PlayCircle size={18} />
              {loading ? 'Evaluating...' : 'Run Simulation'}
            </button>

            {error && <p className="error-msg">{error}</p>}
          </section>

          <section className="content">
            {!result ? (
              <div className="empty-state">
                <BookOpen size={48} />
                <h2>No Results Yet</h2>
                <p>Configure courses and probabilities, then run the simulation to see outcomes.</p>
              </div>
            ) : (
              <div className="results-container">
                <div className="results-header">
                  <h2>Results</h2>
                  <div className="results-actions">
                    <button
                      className="action-btn"
                      onClick={() => copyToClipboard(`CGPA: ${result.summary.expectedCGPA}`)}
                    >
                      <Copy size={16} /> Copy
                    </button>
                    <button className="action-btn" onClick={exportAsCSV}>
                      <Download size={16} /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="stats-grid">
                  {statCard(
                    <TrendingUp size={18} />,
                    'Exact Expected CGPA',
                    result.summary.expectedCGPA.toFixed(3),
                    true,
                  )}
                  {statCard(
                    <Zap size={18} />,
                    `Simulated Mean (n=${result.summary.numTrials})`,
                    result.summary.simulatedMean.toFixed(3),
                  )}
                  {statCard(null, 'Std Deviation (Exact)', result.summary.stdDev.toFixed(3))}
                  {statCard(null, 'Median', result.summary.median.toFixed(3))}
                  {statCard(null, 'P10 → P90', `${result.summary.p10.toFixed(2)} → ${result.summary.p90.toFixed(2)}`)}
                  {statCard(
                    null,
                    `P(CGPA ≥ ${Number(targetCgpa).toFixed(2)})`,
                    `${(result.summary.probabilityAtOrAboveTarget ?? 0).toFixed(1)}%`,
                  )}
                </div>

                <div className="charts-grid">
                  <div className="chart-container">
                    <h3>Probability Distribution</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={result.distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="cgpa" stroke="rgba(255,255,255,0.5)" />
                        <YAxis stroke="rgba(255,255,255,0.5)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                          }}
                          formatter={(value) => `${value.toFixed(2)}%`}
                        />
                        <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                          {result.distribution.map((entry) => (
                            <Cell
                              key={entry.cgpa}
                              fill={entry.cgpa >= Number(targetCgpa) ? '#10b981' : '#3b82f6'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-container">
                    <h3>Cumulative Distribution (CDF)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={distributionForCdf}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="cgpa" stroke="rgba(255,255,255,0.5)" />
                        <YAxis stroke="rgba(255,255,255,0.5)" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                          }}
                          formatter={(value) => `${value.toFixed(1)}%`}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="course-breakdown">
                  <h3>Per-Course Grade Distribution</h3>
                  <div className="breakdown-grid">
                    {result.courseStats.map((course) => (
                      <div className="breakdown-card" key={course.name}>
                        <h4>{course.name}</h4>
                        <p className="grade-point">E[Grade]: {course.expectedGradePoint.toFixed(2)}</p>
                        <div className="grade-bars">
                          {GRADES.map((grade) => (
                            <div key={grade} className="bar-item">
                              <div className="bar-label">
                                <span>{grade}</span>
                                <small>{result.gradeBreakdown[course.name].gradeProbabilities[grade].toFixed(0)}%</small>
                              </div>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{
                                    width: `${result.gradeBreakdown[course.name].gradeProbabilities[grade]}%`,
                                    backgroundColor: GRADE_COLORS[grade],
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  )
}
