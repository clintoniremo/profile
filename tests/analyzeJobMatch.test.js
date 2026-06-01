const { analyzeJobMatch } = require('../autonomous_hunter');

describe('analyzeJobMatch', () => {
  test('scores a strongly relevant finance role above threshold', () => {
    const job = {
      title: 'Senior Finance Officer',
      company: 'NGO Finance Solutions',
      description: 'Seeking a CPA certified accountant with QuickBooks, KRA compliance, audit, and financial reporting experience.'
    };
    const result = analyzeJobMatch(job);
    expect(result.score).toBeGreaterThan(70);
    expect(result.matches).toEqual(expect.arrayContaining(['CPA', 'QUICKBOOKS', 'KRA']));
  });

  test('scores an unrelated engineering role significantly lower', () => {
    const job = {
      title: 'Software Engineer',
      company: 'Tech Startup',
      description: 'Design and build web applications using JavaScript, React, and Node.js.'
    };
    const result = analyzeJobMatch(job);
    expect(result.score).toBeLessThan(60);
  });
});
