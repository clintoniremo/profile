// generateDocs.js - AI powered document generation for job application
// Utilizes OpenAI to create a tailored CV (HTML) and a custom cover letter.

const { generateCV } = require('./openai');
const { Configuration, OpenAIApi } = require('openai');

/**
 * Generate both cover letter (plain text) and HTML CV for a given job.
 * Falls back to null if OpenAI key missing or any error occurs.
 */
async function generateDocs(job, rating, profile) {
  // Prepare OpenAI client (reuse if needed)
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.warn('[AI] OPENAI_API_KEY not set – cannot generate docs via AI.');
    return { coverLetter: null, htmlCv: null };
  }
  const configuration = new Configuration({ apiKey });
  const openai = new OpenAIApi(configuration);

  // 1️⃣ Generate CV (HTML) using existing wrapper
  const htmlCv = await generateCV(profile, job, rating);

  // 2️⃣ Generate Cover Letter (plain text)
  const coverPrompt = `Write a concise, professional cover letter for a CPA named ${profile.name} applying for the position "${job.title}" at "${job.company}". Use the following details:
- Profile: ${profile.title}, email ${profile.email}, phone ${profile.phone}, location ${profile.location}
- Highlight the following matched skills: ${rating.matches.slice(0, 6).join(', ')}.
- Mention the portfolio (${profile.portfolio}) and digital wallet (${profile.wallet}) links.
- Keep the tone formal and end with a polite closing.
Return ONLY the plain text of the cover letter, no markdown or extra formatting.`;

  let coverLetter = '';
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: coverPrompt }],
      temperature: 0.6,
    });
    coverLetter = response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[AI] Cover letter generation failed:', err.message);
    coverLetter = null;
  }

  return { coverLetter, htmlCv };
}

module.exports = { generateDocs };
