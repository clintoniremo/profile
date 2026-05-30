// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Dynamic ESM import for node-fetch to support CommonJS require fallback
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


// Import helpers from autonomous_hunter.js
// Import helpers from autonomous_hunter.js
const {
  fetchOnlineJobs,
  fetchLinkedInJobs,
  dispatchApplicationEmail,
  mergeDocuments
} = require('./autonomous_hunter');

// Import auto-apply function
const { runAutoApply } = require('./auto_apply');

const app = express();
const PORT = process.env.PORT || 3002;
app.use(express.json());
app.use(express.static(__dirname));;

// ---------- Upload handling ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const type = req.query.type || 'file';
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${type}_${base}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  const type = req.query.type || 'file';
  const savedPath = path.join('uploads', req.file.filename);
  res.json({ success: true, type, path: savedPath });
});

app.post('/api/uploadPoster', upload.single('file'), (req, res) => {
  const savedPath = path.join('uploads', req.file.filename);
  res.json({ success: true, path: savedPath });
});

// ---------- Jobs endpoint ----------
app.get('/api/jobs', async (_, res) => {
  try {
    const online = await fetchOnlineJobs();
    const linkedIn = await fetchLinkedInJobs();
    const jobs = [...online, ...linkedIn];
    res.json({ jobs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- AI Proxy Endpoint for Claude ----------
app.post('/api/ai', async (req, res) => {
  const { messages, system, max_tokens, temperature } = req.body;
  const clientKey = req.headers['x-anthropic-key'];
  const apiKey = clientKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'xxxx xxxx xxxx xxxx') {
    return res.status(400).json({ error: 'Missing Anthropic API Key. Please configure it in the Dashboard Settings (top-right gear icon) or backend .env file.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: max_tokens || 4000,
        temperature: temperature ?? 0.3,
        system: system,
        messages: messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Anthropic API error');
    }
    res.json(data);
  } catch (e) {
    console.error('Claude API Proxy Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- SerpAPI Proxy Endpoint ----------
app.post('/api/scrape-jobs', async (req, res) => {
  const { query, location } = req.body;
  const clientKey = req.headers['x-serpapi-key'];
  const apiKey = clientKey || process.env.SERPAPI_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing SerpAPI Key. Please configure it in Settings.' });
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(query)}&location=${encodeURIComponent(location || 'Kenya')}&hl=en&api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'SerpAPI search error');
    }
    
    // Map SerpAPI jobs to our standard format
    const jobs = (data.jobs_results || []).map(job => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      category: 'Finance / ' + (job.detected_extensions?.schedule_type || 'Full-time'),
      description: job.description || 'No description provided.',
      url: job.related_links?.[0]?.link || 'https://google.com/search?q=' + encodeURIComponent(job.title + ' ' + job.company_name),
      pubDate: new Date().toISOString()
    }));
    
    res.json({ jobs });
  } catch (e) {
    console.error('SerpAPI Proxy Error:', e);
    res.status(500).json({ error: e.message });
  }
});


// ---------- Merge PDF endpoint ----------
app.post('/api/merge', async (req, res) => {
  const { cvPath, coverPath } = req.body;
  if (!cvPath || !coverPath) {
    return res.status(400).json({ error: 'Missing cvPath or coverPath' });
  }
  try {
    const mergedPath = await mergeDocuments(cvPath, coverPath);
    res.json({ mergedPath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Apply job endpoint ----------
app.post('/api/apply', async (req, res) => {
  const { job, mergedPdfPath } = req.body;
  if (!job || !mergedPdfPath) {
    return res.status(400).json({ error: 'Missing job or mergedPdfPath' });
  }
  try {
    await dispatchApplicationEmail(job, { score: 100, matches: [] }, { pdfPath: mergedPdfPath });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Apply poster job endpoint ----------
app.post('/api/applyPosterJob', async (req, res) => {
  const { job, posterPath } = req.body;
  if (!job || !posterPath) {
    return res.status(400).json({ error: 'Missing job or posterPath' });
  }
  try {
    // Attach poster as an extra file using the existing email function's extraAttachments option.
    const extraAttachments = [{ filename: path.basename(posterPath), path: posterPath }];
    // Extend dispatchApplicationEmail signature to accept extraAttachments via paths param.
    await dispatchApplicationEmail(job, { score: 100, matches: [] }, { extraAttachments });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- Auto Apply route ----------
app.post('/api/autoApply', async (req, res) => {
  try {
    const result = await runAutoApply();
    res.json({ success: true, result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


// Export app for Vercel Serverless Functions
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Dashboard API running on http://localhost:${PORT}`));
}

