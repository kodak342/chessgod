// The coach and tutor explanations call Claude through this one function.
// On claude.ai a built-in connection exists; on your own site it does not yet.
// Later, replace the body with a fetch() to your own small backend.
export async function askClaude(prompt, opts = {}) {
  const sample = window.claude && (await window.claude.use('sample'));
  if (!sample) {
    throw { message: 'The coach needs a connection to Claude, which only exists in the claude.ai version for now. Adding it to this site is a later step.' };
  }
  return sample(prompt, opts);
}
