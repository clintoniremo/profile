// auto_apply.js
// This module implements the fully‑automated job‑application flow.
// It is used by the server route /api/autoApply which can be triggered manually
// or via Vercel's cron scheduler.

const path = require('path');
const fs = require('fs');

// Import helper functions from autonomous_hunter.js
const {
  fetchOnlineJobs,
  fetchLinkedInJobs,
  mergeDocuments,
  dispatchApplicationEmail,
} = require('./autonomous_hunter');

/**
 * Configuration for automatic applications.
 * Adjust these values to control which jobs are applied to.
 */
const AUTO_APPLY_CONFIG = {
  // Minimum score (0-100) for a job to be considered.
  minScore: 80,
  // Maximum number of applications per run to avoid spamming.
  maxApplications: 5,
  // Paths to the CV and cover letter PDFs that will be merged.
  cvPath: path.join(__dirname, 'uploads', 'cv.pdf'),
  coverPath: path.join(__dirname, 'uploads', 'cover.pdf'),
};

/**
 * Main function that performs the automatic application process.
 * Returns a summary object describing what was done.
 */
async function runAutoApply() {
  // Ensure the source documents exist.
  if (!fs.existsSync(AUTO_APPLY_CONFIG.cvPath) || !fs.existsSync(AUTO_APPLY_CONFIG.coverPath)) {
    throw new Error('CV or cover letter not found. Upload them via /api/upload?type=cv and /api/upload?type=cover first.');
  }

  // 1️⃣ Fetch jobs from both sources.
  const [onlineJobs, linkedInJobs] = await Promise.all([
    fetchOnlineJobs(),
    fetchLinkedInJobs(),
  ]);
  const allJobs = [...onlineJobs, ...linkedInJobs];

  // 2️⃣ Score and filter jobs. For now we use a simple placeholder score.
  // In a real system you would have a ML model; here we assume each job has a `score` field.
  const filtered = allJobs
    .filter(job => (job.score ?? 0) >= AUTO_APPLY_CONFIG.minScore)
    .slice(0, AUTO_APPLY_CONFIG.maxApplications);

  if (filtered.length === 0) {
    return { applied: 0, message: 'No jobs met the criteria.' };
  }

  // 3️⃣ Merge CV and cover letter into a single PDF (once per run).
  const mergedPath = await mergeDocuments(AUTO_APPLY_CONFIG.cvPath, AUTO_APPLY_CONFIG.coverPath);

  // 4️⃣ Apply to each job.
  for (const job of filtered) {
    try {
      await dispatchApplicationEmail(job, { score: job.score, matches: [] }, { pdfPath: mergedPath });
    } catch (e) {
      console.error('Failed to apply to job', job, e);
    }
  }

  return { applied: filtered.length, mergedPath, jobs: filtered.map(j => ({ title: j.title, company: j.company, link: j.link })) };
}

module.exports = { runAutoApply };
