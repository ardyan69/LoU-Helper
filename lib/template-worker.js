// Runs a layout template (military / hub) off the page thread so the dialog stays responsive.
// in:  { kind: 'mil' | 'hub' | 'gold', base, opts }   out: { progress: 0..1 } … then { done: result } or { error }
import { militaryTemplate, hubTemplate, goldPlan } from './templates.js';

self.onmessage = (e) => {
  const { kind, base, opts } = e.data || {};
  let last = 0;
  const onProgress = (f) => { if (f - last >= 0.02 || f === 0) { last = f; self.postMessage({ progress: f }); } };
  try {
    const run = kind === 'hub' ? hubTemplate : kind === 'gold' ? goldPlan : militaryTemplate;
    const done = run(base, { ...opts, onProgress });
    self.postMessage({ done });
  } catch (err) {
    self.postMessage({ error: String(err?.message || err) });
  }
};
