// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

app.listen(PORT, () => console.log(`🚀 Dashboard API running on http://localhost:${PORT}`));
