const GRADE_POINTS = { EX: 10, A: 9, B: 8, C: 7, D: 6, P: 5, F: 0 };
const GRADE_ORDER = ['EX', 'A', 'B', 'C', 'D', 'P', 'F'];
const PROB_TOLERANCE = 1e-6;

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function validateCourse(course, index) {
  const errors = [];

  if (!course || typeof course !== 'object') {
    return [`Course ${index + 1}: invalid payload`];
  }

  if (!course.name || typeof course.name !== 'string' || !course.name.trim()) {
    errors.push(`Course ${index + 1}: missing or invalid name`);
  }

  const credits = Number(course.credits);
  if (!Number.isInteger(credits) || credits < 1) {
    errors.push(`Course "${course.name || index + 1}": credits must be an integer >= 1`);
  }

  if (!course.probabilities || typeof course.probabilities !== 'object') {
    errors.push(`Course "${course.name || index + 1}": missing probabilities`);
    return errors;
  }

  let total = 0;
  for (const grade of GRADE_ORDER) {
    const p = Number(course.probabilities[grade] ?? 0);
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      errors.push(`Course "${course.name || index + 1}": probability for ${grade} must be between 0 and 1`);
    }
    total += p;
  }

  if (Math.abs(total - 1) > PROB_TOLERANCE) {
    errors.push(`Course "${course.name || index + 1}": probabilities must sum to 1.0 (got ${total.toFixed(6)})`);
  }

  return errors;
}

function normalizeCourses(courses) {
  return courses.map((course) => {
    const probabilities = {};
    for (const grade of GRADE_ORDER) probabilities[grade] = Number(course.probabilities[grade] ?? 0);
    return {
      name: course.name.trim(),
      credits: Number(course.credits),
      probabilities,
    };
  });
}

function computeOutcomeDistribution(courses) {
  let scoreDistribution = new Map([[0, 1]]);

  for (const course of courses) {
    const next = new Map();
    for (const [score, scoreProb] of scoreDistribution.entries()) {
      for (const grade of GRADE_ORDER) {
        const gradeProb = course.probabilities[grade];
        if (gradeProb <= 0) continue;
        const nextScore = score + GRADE_POINTS[grade] * course.credits;
        next.set(nextScore, (next.get(nextScore) || 0) + scoreProb * gradeProb);
      }
    }
    scoreDistribution = next;
  }

  return scoreDistribution;
}

function percentileFromOutcomes(outcomes, p) {
  const threshold = p / 100;
  let cumulative = 0;
  for (const outcome of outcomes) {
    cumulative += outcome.probability;
    if (cumulative + PROB_TOLERANCE >= threshold) return outcome.cgpa;
  }
  return outcomes[outcomes.length - 1]?.cgpa ?? 0;
}

function buildBucketDistribution(outcomes, bucketStep = 0.1) {
  const buckets = new Map();
  for (const outcome of outcomes) {
    const bucket = (Math.round(outcome.cgpa / bucketStep) * bucketStep).toFixed(1);
    buckets.set(bucket, (buckets.get(bucket) || 0) + outcome.probability);
  }

  return Array.from(buckets.entries())
    .map(([cgpa, probability]) => ({
      cgpa: Number(cgpa),
      probability: round3(probability * 100),
    }))
    .sort((a, b) => a.cgpa - b.cgpa);
}

function buildCourseStats(courses) {
  return courses.map((course) => {
    let expectedPoints = 0;
    for (const grade of GRADE_ORDER) expectedPoints += course.probabilities[grade] * GRADE_POINTS[grade];
    return {
      name: course.name,
      credits: course.credits,
      expectedGradePoint: round3(expectedPoints),
      weightedContribution: round3(expectedPoints * course.credits),
    };
  });
}

function buildGradeBreakdown(courses) {
  const breakdown = {};
  for (const course of courses) {
    const gradeProbabilities = {};
    for (const grade of GRADE_ORDER) {
      gradeProbabilities[grade] = round3(course.probabilities[grade] * 100);
    }
    breakdown[course.name] = { credits: course.credits, gradeProbabilities };
  }
  return breakdown;
}

function countPossiblePaths(courses) {
  let paths = 1n;
  for (const course of courses) {
    const availableGrades = GRADE_ORDER.filter((grade) => course.probabilities[grade] > 0).length;
    paths *= BigInt(Math.max(availableGrades, 1));
  }
  return paths.toString();
}

function sampleGrade(probabilities) {
  const rand = Math.random();
  let cumulative = 0;
  for (const grade of GRADE_ORDER) {
    cumulative += probabilities[grade] || 0;
    if (rand <= cumulative) return grade;
  }
  return GRADE_ORDER[GRADE_ORDER.length - 1];
}

function runMonteCarlo(courses, numTrials) {
  let mean = 0;
  let m2 = 0;

  for (let i = 1; i <= numTrials; i++) {
    let weightedSum = 0;
    let totalCredits = 0;
    for (const course of courses) {
      const grade = sampleGrade(course.probabilities);
      weightedSum += GRADE_POINTS[grade] * course.credits;
      totalCredits += course.credits;
    }
    const cgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
    const delta = cgpa - mean;
    mean += delta / i;
    const delta2 = cgpa - mean;
    m2 += delta * delta2;
  }

  const variance = numTrials > 1 ? m2 / numTrials : 0;
  return {
    simulatedMean: round3(mean),
    simulatedStdDev: round3(Math.sqrt(variance)),
  };
}

function runSimulation(courses, targetCgpa, numTrials = 0) {
  const normalized = normalizeCourses(courses);
  const totalCredits = normalized.reduce((sum, course) => sum + course.credits, 0);
  const scoreDistribution = computeOutcomeDistribution(normalized);

  const outcomes = Array.from(scoreDistribution.entries())
    .map(([score, probability]) => ({
      score,
      cgpa: round3(score / totalCredits),
      probability,
    }))
    .sort((a, b) => a.cgpa - b.cgpa);

  let mean = 0;
  let secondMoment = 0;
  let probabilityAtOrAboveTarget = null;
  const hasTarget = Number.isFinite(targetCgpa);

  for (const outcome of outcomes) {
    mean += outcome.cgpa * outcome.probability;
    secondMoment += outcome.cgpa * outcome.cgpa * outcome.probability;
  }

  if (hasTarget) {
    probabilityAtOrAboveTarget = outcomes
      .filter((outcome) => outcome.cgpa + PROB_TOLERANCE >= targetCgpa)
      .reduce((sum, outcome) => sum + outcome.probability, 0);
  }

  const variance = Math.max(0, secondMoment - mean * mean);
  const stdDev = Math.sqrt(variance);
  const shouldSimulate = Number.isFinite(numTrials) && numTrials > 0;
  const mcStats = shouldSimulate ? runMonteCarlo(normalized, numTrials) : null;

  const summary = {
    expectedCGPA: round3(mean),
    simulatedMean: mcStats?.simulatedMean ?? round3(mean),
    simulatedStdDev: mcStats?.simulatedStdDev ?? round3(stdDev),
    stdDev: round3(stdDev),
    median: percentileFromOutcomes(outcomes, 50),
    p10: percentileFromOutcomes(outcomes, 10),
    p25: percentileFromOutcomes(outcomes, 25),
    p75: percentileFromOutcomes(outcomes, 75),
    p90: percentileFromOutcomes(outcomes, 90),
    best: outcomes[outcomes.length - 1]?.cgpa ?? 0,
    worst: outcomes[0]?.cgpa ?? 0,
    totalCredits,
    numTrials: shouldSimulate ? numTrials : 0,
    outcomeStates: outcomes.length,
    evaluatedPaths: countPossiblePaths(normalized),
    probabilityAtOrAboveTarget: hasTarget ? round3(probabilityAtOrAboveTarget * 100) : null,
  };

  return {
    method: 'exact-probabilistic-convolution',
    summary,
    distribution: buildBucketDistribution(outcomes),
    exactDistribution: outcomes.map((outcome) => ({
      cgpa: outcome.cgpa,
      probability: round3(outcome.probability * 100),
    })),
    gradeBreakdown: buildGradeBreakdown(normalized),
    courseStats: buildCourseStats(normalized),
    gradePoints: GRADE_POINTS,
    gradeOrder: GRADE_ORDER,
  };
}

module.exports = { runSimulation, validateCourse, GRADE_POINTS, GRADE_ORDER };
