const express = require('express');
const router = express.Router();
const { runSimulation, validateCourse, GRADE_POINTS, GRADE_ORDER } = require('../simulation');

/**
 * POST /api/simulate
 * Body: {
 *   courses: [
 *     {
 *       name: "Mathematics",
 *       credits: 4,
 *       probabilities: { EX: 0.1, A: 0.3, B: 0.4, C: 0.15, D: 0.05, P: 0, F: 0 }
 *     },
 *     ...
 *   ],
 *   targetCgpa?: number,
 *   numTrials?: number
 * }
 */
router.post('/simulate', (req, res) => {
  try {
    const { courses, targetCgpa, numTrials: rawTrials } = req.body;

    // Validate input structure
    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ error: 'courses must be a non-empty array' });
    }

    if (courses.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 courses allowed per simulation' });
    }

    // Validate each course
    const allErrors = [];
    for (let i = 0; i < courses.length; i++) {
      const errors = validateCourse(courses[i], i);
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: allErrors });
    }

    const startTime = Date.now();
    const parsedTarget = Number(targetCgpa);
    const parsedTrials = Number(rawTrials);
    const safeTrials = Number.isFinite(parsedTrials)
      ? Math.min(Math.max(Math.round(parsedTrials), 1000), 200000)
      : 0;
    const result = runSimulation(
      courses,
      Number.isFinite(parsedTarget) ? parsedTarget : undefined,
      safeTrials,
    );
    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      computationTimeMs: elapsed,
      ...result,
    });
  } catch (err) {
    console.error('[/simulate]', err);
    res.status(500).json({ error: 'Simulation failed: ' + err.message });
  }
});

/**
 * GET /api/grades
 * Returns available grades and their point values.
 */
router.get('/grades', (_req, res) => {
  res.json({ gradePoints: GRADE_POINTS, gradeOrder: GRADE_ORDER });
});

module.exports = router;
