// OpenAI AI provider wrapper for CV generation
// Reads API key from environment variable OPENAI_API_KEY.
// Exposes async function generateCV(profile, job, rating) that returns HTML CV content.

const { Configuration, OpenAIApi } = require('openai');

/**
 * Generate a tailored CV in HTML using OpenAI.
 * @param {object} profile - USER profile object from CONFIG.
 * @param {object} job - Job object with title, company, description.
 * @param {object} rating - Rating object with score and matches.
 * @returns {Promise<string>} HTML string of the generated CV.
 */
async function generateCV(profile, job, rating) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.warn('[AI] OpenAI API key not set – falling back to static CV generation.');
    return null; // Signal caller to use fallback.
  }

  const configuration = new Configuration({ apiKey });
  const openai = new OpenAIApi(configuration);

  const prompt = `You are an AI assistant that writes a professional HTML Curriculum Vitae for a CPA named ${profile.name}. Use the following data:
- Title: ${profile.title}
- Contact: ${profile.email}, ${profile.phone}, ${profile.location}
- Portfolio: ${profile.portfolio}
- Wallet: ${profile.wallet}
- LinkedIn: ${profile.linkedin}
- Keywords: ${profile.keywords.join(', ')}
- Education: ${profile.education.join('; ')}
- Highlights: ${profile.highlights.join('; ')}

Create a CV tailored to the job posting:
Job Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Match Score: ${rating.score}% (highlight matched keywords).

The CV should be a complete HTML document with modern styling (use inline CSS, no external files). Include sections: Professional Summary, Key Competencies (show matched keywords), Core Achievements, Professional Experience (use placeholder experience), Education & Credentials. Emphasize the match score and CPA certification.
Return ONLY the HTML code, without any markdown fences.`;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4o-mini', // default model; can be overridden by config later
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    const html = response.data.choices[0].message.content.trim();
    return html;
  } catch (err) {
    console.error('[AI] OpenAI request failed:', err.message);
    return null;
  }
}

module.exports = { generateCV };
