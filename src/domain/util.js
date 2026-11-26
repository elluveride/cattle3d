export const byId = (list, id) => list.find((item) => item.id === id) ?? null;

export const countBy = (list, key) =>
  list.reduce((acc, item) => ({ ...acc, [item[key]]: (acc[item[key]] ?? 0) + 1 }), {});

export const byName = (a, b) => a.name.localeCompare(b.name);

export const sum = (numbers) => numbers.reduce((total, n) => total + n, 0);

export const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));
