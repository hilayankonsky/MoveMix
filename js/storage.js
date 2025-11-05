
// שם המפתח בלוקאל סטורג'
const KEY = 'movemix:v1';

// ברירות מחדל של ערכי MET
export const DEFAULT_MET = {
  tennis: 8,
  strength: 5.5,
  pilates: 3.2,
  yoga: 3.0,
  other: 3.0,
};

// מצב התחלתי
const DEFAULTS = {
  sessions: [],
  settings: {
    weightKg: null,          // ריק כברירת מחדל
    MET: { ...DEFAULT_MET }, // ברירות מחדל מלאות
  }
};

// פונקציה שמנקה ומאחדת ערכי MET
function cleanMET(raw){
  const m = { ...DEFAULT_MET, ...(raw || {}) };
  for (const k of Object.keys(DEFAULT_MET)) {
    const n = Number(m[k]);
    m[k] = (Number.isFinite(n) && n > 0) ? n : DEFAULT_MET[k];
  }
  return m;
}

// שליפה מה־localStorage
export function getAll(){
  const raw = localStorage.getItem(KEY);
  if (!raw) return structuredClone(DEFAULTS);
  try {
    const obj = JSON.parse(raw);
    return {
      sessions: Array.isArray(obj.sessions) ? obj.sessions : [],
      settings: {
        weightKg: (obj.settings?.weightKg ?? null),
        MET: cleanMET(obj.settings?.MET),
      }
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

// שמירה
export function save(state){
  localStorage.setItem(KEY, JSON.stringify(state));
}

// ניקוי מוחלט
export function clearAll(){
  localStorage.removeItem(KEY);
}

// ====================
// ניהול אימונים
// ====================

export function addSession(sess) {
  const state = getAll();

  // שליפת משקל וערכי MET נוכחיים
  const w = state.settings?.weightKg ?? null;
  const metMap = state.settings?.MET || {};
  const met = metMap[sess.type] ?? 3.0;

  const duration = Number(sess.durationMin) || 0;
  const hasManual = typeof sess.caloriesManual === 'number' && !Number.isNaN(sess.caloriesManual);
  const fixedCalories = hasManual ? null : (w ? Math.round(met * w * duration / 60) : null);

  const session = {
    ...sess,
    weightAtLog: w,
    metAtLog: met,
    ...(fixedCalories !== null ? { caloriesFixed: fixedCalories } : {})
  };

  state.sessions.push(session);
  save(state);
}

export function updateSession(id, patch) {
  const state = getAll();
  const idx = state.sessions.findIndex(s => s.id === id);
  if (idx === -1) return;

  const prev = state.sessions[idx];
  const next = { ...prev, ...patch };

  if ('caloriesManual' in patch && (patch.caloriesManual === '' || patch.caloriesManual === null)) {
    delete next.caloriesManual;
  }

  const hasManual = typeof next.caloriesManual === 'number' && !Number.isNaN(next.caloriesManual);

  if (hasManual) {
    delete next.caloriesFixed;
  } else {
    if (typeof next.weightAtLog !== 'number') {
      next.weightAtLog = state.settings?.weightKg ?? null;
    }
    const typeNow = next.type;
    const metForTypeNow = state.settings?.MET?.[typeNow] ?? next.metAtLog ?? 3.0;
    next.metAtLog = metForTypeNow;

    const dur = Number(next.durationMin) || 0;
    next.caloriesFixed = (typeof next.weightAtLog === 'number'
      ? Math.round(next.metAtLog * next.weightAtLog * dur / 60)
      : null);
  }

  state.sessions[idx] = next;
  save(state);
}

export function removeSession(id){
  const state = getAll();
  state.sessions = state.sessions.filter(s => s.id !== id);
  save(state);
}

// ====================
// Settings helpers (נחוצים ל-main.js)
// ====================

export function getSettings(){
  return getAll().settings;
}

export function setSettings(patch){
  const state = getAll();
  const next = { ...state.settings };

  if ('weightKg' in patch) {
    const w = Number(patch.weightKg);
    next.weightKg = (Number.isFinite(w) && w > 0) ? w : null;
  }

  if ('MET' in patch && patch.MET) {
    // ניקוי ואיחוד ערכי MET
    const cleaned = {};
    const src = { ...DEFAULT_MET, ...patch.MET };
    for (const k of Object.keys(DEFAULT_MET)) {
      const n = Number(src[k]);
      cleaned[k] = (Number.isFinite(n) && n > 0) ? n : DEFAULT_MET[k];
    }
    next.MET = cleaned;
  }

  state.settings = next;
  save(state);
}

export function resetSettingsToDefault(){
  const state = getAll();
  state.settings = {
    weightKg: null,
    MET: { ...DEFAULT_MET },
  };
  save(state);
}

export function exportData(){
  // מחזיר את כל המצב כפי שהוא
  return getAll();
}

export function importData(obj){
  // ולידציה קלה כדי לא לשבור מצב
  const safe = {
    sessions: Array.isArray(obj?.sessions) ? obj.sessions : [],
    settings: {
      weightKg: (Number.isFinite(Number(obj?.settings?.weightKg)) ? Number(obj.settings.weightKg) : null),
      MET: (() => {
        const m = { ...DEFAULT_MET, ...(obj?.settings?.MET || {}) };
        for (const k of Object.keys(DEFAULT_MET)) {
          const n = Number(m[k]);
          m[k] = (Number.isFinite(n) && n > 0) ? n : DEFAULT_MET[k];
        }
        return m;
      })()
    }
  };
  save(safe);
}

