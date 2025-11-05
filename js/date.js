export function todayISO() { return new Date().toISOString().slice(0,10); }

export function weekKey(d) {
  const dt = new Date(d + 'T00:00');
  const onejan = new Date(dt.getFullYear(), 0, 1);
  const days = Math.floor((dt - onejan) / 86400000) + onejan.getDay();
  const week = Math.ceil((days + 1) / 7);
  return `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
