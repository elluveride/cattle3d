// "Helped a teammate | +5" per line
export function parsePresets(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const presets = lines
    .map((line) => line.match(/^(.+?)\s*\|\s*([+-]?\d+)$/))
    .filter(Boolean)
    .map((m) => ({ label: m[1].trim(), delta: Number(m[2]) }))
    .filter((p) => p.delta !== 0);
  return { presets, skipped: lines.length - presets.length };
}

export const formatPresets = (presets) =>
  presets.map((p) => `${p.label} | ${p.delta > 0 ? '+' : ''}${p.delta}`).join('\n');
