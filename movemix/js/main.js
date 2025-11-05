
// ===== Imports =====
import {
  getAll, addSession, removeSession, clearAll, updateSession,
  setSettings, resetSettingsToDefault, exportData, importData, DEFAULT_MET
} from './storage.js';
import { todayISO } from './date.js';
import { caloriesFor, kpisThisWeek, kpisThisMonth } from './stats.js';
import { refreshCharts } from './charts.js';

// להריץ הודעת "ברוכה הבאה" מיד עם עליית הדף
document.addEventListener('DOMContentLoaded', updateWelcome);

// ===== El refs =====
const form = document.getElementById('session-form');
const tableBody = document.querySelector('#history-table tbody');

const searchInp = document.getElementById('search');
const fromInp   = document.getElementById('from');
const toInp     = document.getElementById('to');

const typeSelect   = document.getElementById('type');
const otherLabel   = document.getElementById('otherLabel');
const otherNameInp = document.getElementById('otherName');

const setForm   = document.getElementById('settings-form');
const weightInp = document.getElementById('set-weight');
const metInputs = {
  tennis:   document.getElementById('met-tennis'),
  strength: document.getElementById('met-strength'),
  pilates:  document.getElementById('met-pilates'),
  yoga:     document.getElementById('met-yoga'),
  other:    document.getElementById('met-other'),
};

// ===== Theme toggle =====
const root = document.documentElement;
const btnTheme = document.getElementById('themeToggle');
btnTheme?.addEventListener('click', ()=>{
  root.classList.toggle('dark');
  btnTheme.textContent = root.classList.contains('dark') ? 'מצב בהיר' : 'מצב כהה';
});

// ===== Helpers =====
function $id(id){ return document.getElementById(id); }

// ===== “אחר” דינמי =====
function toggleOther(){
  if(!typeSelect) return;
  if(typeSelect.value === 'other'){
    otherLabel && (otherLabel.style.display = 'flex');
  } else {
    if(otherLabel) otherLabel.style.display = 'none';
    if(otherNameInp) otherNameInp.value = '';
  }
}
typeSelect?.addEventListener('change', toggleOther);
toggleOther();

// ===== עריכה =====
let editId = null; // האם בטופס מצב עריכה?

// תאריך ברירת מחדל
$id('date').value = todayISO();

// ===== הוספה/עדכון אימון =====
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = collectForm();
  if (!data) return;

  if (editId) {
    const { id, ...patch } = data; // לא משנים id
    updateSession(editId, patch);
    editId = null;
    form.querySelector('button.primary').textContent = 'שמור אימון';
  } else {
    addSession(data);
  }

  form.reset();
  $id('date').value = todayISO();
  toggleOther();
  draw();
});

// ===== ייצוא/ייבוא =====
$id('piePeriod')?.addEventListener('change', refreshCharts);

$id('export-json')?.addEventListener('click', ()=>{
  const data = exportData();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `movemix_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

$id('import-json')?.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    importData(obj);
    loadSettingsToForm(); // לרענן נתונים
    draw();               // לרענן KPI/עוגה/היסטוריה
    alert('הנתונים נטענו בהצלחה ✅');
  }catch(err){
    alert('קובץ לא תקין ❌');
  }finally{
    e.target.value = '';
  }
});

// ===== סינון/ניקוי =====
$id('filter-btn').addEventListener('click', draw);
$id('clear-all').addEventListener('click', () => {
  if (confirm('למחוק את כל הנתונים?')) { clearAll(); draw(); }
});

// ===== איסוף נתוני טופס אימון =====
function collectForm() {
  const date = $id('date').value;
  const type = $id('type').value;
  const durationMin = Number($id('duration').value);
  const intensity = Number($id('intensity').value);
  const notes = $id('notes').value.trim();
  const caloriesManualStr = $id('caloriesManual')?.value.trim() || '';
  const caloriesManual = caloriesManualStr ? Number(caloriesManualStr) : null;
  const customLabel = (type === 'other' ? ($id('otherName')?.value.trim() || '') : '');

  if (!date || !type || !durationMin || durationMin < 1) {
    alert('נא למלא תאריך ומשך תקין (≥1).'); return null;
  }
  if (caloriesManual !== null && caloriesManual < 0) {
    alert('קלוריות חייבות להיות מספר לא שלילי.'); return null;
  }

  return {
    id: `sess_${Date.now()}`,
    type, date, durationMin, intensity, notes,
    ...(caloriesManual !== null ? { caloriesManual } : {}),
    ...(customLabel ? { customLabel } : {})
  };
}

// ================= SETTINGS =================
function loadSettingsToForm(){
  const { settings } = getAll();
  const MET = { ...DEFAULT_MET, ...(settings.MET || {}) };

  // משקל – השדה אצלך הוא set-weight
  if (weightInp) {
    weightInp.value = (settings.weightKg ?? '');
  }

  // שדות MET (IDs קיימים אצלך)
  metInputs.tennis  && (metInputs.tennis.value   = MET.tennis);
  metInputs.strength&& (metInputs.strength.value = MET.strength);
  metInputs.pilates && (metInputs.pilates.value  = MET.pilates);
  metInputs.yoga    && (metInputs.yoga.value     = MET.yoga);
  metInputs.other   && (metInputs.other.value    = MET.other);
}

// להריץ טעינת נתונים לטופס כשהעמוד מוכן
document.addEventListener('DOMContentLoaded', loadSettingsToForm);

// שמירת הגדרות
setForm?.addEventListener('submit', (e)=>{
  e.preventDefault();

  const weight = Number(weightInp?.value);
  if(!weight || weight < 30 || weight > 200){
    alert('משקל צריך להיות בין 30 ל-200 ק״ג');
    return;
  }

  // קוראים ערכי MET מהשדות; נופלים לברירת מחדל אם ריק/לא מספר
  const safeNum = (el, fallback) => {
    const n = Number(el?.value);
    return (Number.isFinite(n) && n > 0) ? n : fallback;
  };

  const MET = {
    tennis:   safeNum(metInputs.tennis,   DEFAULT_MET.tennis),
    strength: safeNum(metInputs.strength, DEFAULT_MET.strength),
    pilates:  safeNum(metInputs.pilates,  DEFAULT_MET.pilates),
    yoga:     safeNum(metInputs.yoga,     DEFAULT_MET.yoga),
    other:    safeNum(metInputs.other,    DEFAULT_MET.other),
  };

  setSettings({ weightKg: weight, MET });
  loadSettingsToForm(); // עדכון טופס
  draw();               // KPI/גרפים/טבלה
  alert('ההגדרות נשמרו ✅');
});

// איפוס לברירות מחדל
$id('settings-reset')?.addEventListener('click', ()=>{
  if(confirm('לאפס את ההגדרות לערכי ברירת־מחדל?')){
    resetSettingsToDefault();
    loadSettingsToForm();
    draw();
  }
});

// ================= DRAW =================
function draw(){
  // KPI שבועי
  const kW = kpisThisWeek();
  let caloriesW = 0;
  const { sessions } = getAll();
  for(const s of sessions){
    const d = new Date(s.date+'T12:00');
    if(d >= kW.range.start && d <= kW.range.end){
      caloriesW += caloriesFor(s);
    }
  }
  $id('kpi-workouts').textContent = kW.workouts;
  $id('kpi-minutes').textContent  = kW.minutes;
  $id('kpi-calories').textContent = caloriesW;
  const weekRangeEl = $id('weekRange');
  if(weekRangeEl){
    const fmt = d => d.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
    weekRangeEl.textContent = `${fmt(kW.range.start)}–${fmt(kW.range.end)} (שבוע נוכחי)`;
  }

  // KPI חודשי
  const kM = kpisThisMonth();
  let caloriesM = 0;
  for(const s of sessions){
    const d = new Date(s.date+'T12:00');
    if(d >= kM.range.start && d <= kM.range.end){
      caloriesM += caloriesFor(s);
    }
  }
  $id('kpiM-workouts').textContent = kM.workouts;
  $id('kpiM-minutes').textContent  = kM.minutes;
  $id('kpiM-calories').textContent = caloriesM;
  const monthRangeEl = $id('monthRange');
  if(monthRangeEl){
    const fmt = d => d.toLocaleDateString('he-IL',{month:'2-digit',year:'2-digit'});
    monthRangeEl.textContent = `${fmt(kM.range.start)} (חודש נוכחי)`;
  }

  renderTable();
  refreshCharts();
  updateWelcome();
}

// ================= HISTORY TABLE =================
function renderTable() {
  const { sessions } = getAll();
  const q    = (searchInp.value || '').toLowerCase();
  const from = fromInp.value ? new Date(fromInp.value + 'T00:00') : null;
  const to   = toInp.value   ? new Date(toInp.value   + 'T23:59') : null;

  const filtered = sessions.filter(s => {
    const typeLabel = labelOf(s.type).toLowerCase();
    const hit = !q
      || (s.notes || '').toLowerCase().includes(q)
      || s.type.includes(q)
      || typeLabel.includes(q);
    const d = new Date(s.date + 'T12:00');
    const okFrom = !from || d >= from;
    const okTo   = !to   || d <= to;
    return hit && okFrom && okTo;
  }).sort((a,b) => b.date.localeCompare(a.date));

  tableBody.innerHTML = '';
  for (const s of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${labelOf(s.type)}${s.customLabel ? ' — ' + escapeHtml(s.customLabel) : ''}</td>
      <td>${s.durationMin}</td>
      <td>${s.intensity || ''}</td>
      <td>${caloriesFor(s)}</td>
      <td>${escapeHtml(s.notes || '')}</td>
      <td style="white-space:nowrap;">
        <button data-id="${s.id}" class="secondary edit">עריכה</button>
        <button data-id="${s.id}" class="danger del">מחק</button>
      </td>`;
    tableBody.appendChild(tr);
  }
}

// האזנה אחת לטבלה – עריכה/מחיקה
tableBody.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id;
  if(!id) return;

  if(btn.classList.contains('del')){
    e.preventDefault();
    if(!confirm('האם את בטוחה שברצונך למחוק את האימון?')) return;
    removeSession(id);
    draw();
    return;
  }

  if(btn.classList.contains('edit')){
    const { sessions } = getAll();
    const s = sessions.find(x => x.id === id);
    if(!s) return;
    fillFormFromSession(s);
    editId = s.id;
    form.querySelector('button.primary').textContent = 'עדכון אימון';
    document.getElementById('form').scrollIntoView({ behavior: 'smooth' });
  }
});

function fillFormFromSession(s){
  $id('date').value = s.date;
  $id('type').value = s.type;
  toggleOther();
  if (s.type === 'other' && otherNameInp) {
    otherNameInp.value = s.customLabel || '';
  }
  $id('duration').value  = s.durationMin;
  $id('intensity').value = s.intensity || 3;
  $id('notes').value     = s.notes || '';
  const cm = $id('caloriesManual');
  if (cm) cm.value = (typeof s.caloriesManual === 'number' ? s.caloriesManual : '');
}

// ===== Utils =====
function labelOf(type) {
  return { tennis:'טניס', strength:'כוח', pilates:'פילאטיס', yoga:'יוגה', other:'אחר' }[type] || type;
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m]));
}
function updateWelcome(){
  const el = $id('welcome');
  if(!el) return;
  const state = getAll();
  const emptySessions = !state.sessions || state.sessions.length === 0;
  const noWeight      = !state.settings || !state.settings.weightKg;
  el.classList.toggle('hidden', !(emptySessions || noWeight));
}

// ===== Tooltip MET =====
const helpIcon = $id('met-help');
const tooltip  = $id('met-tooltip');

if (helpIcon && tooltip) {
  helpIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = tooltip.classList.contains('hidden');
    tooltip.classList.toggle('hidden');
    helpIcon.setAttribute('aria-expanded', String(willShow));
  });

  document.addEventListener('click', (e) => {
    if (!tooltip.classList.contains('hidden')) {
      const clickedInside = tooltip.contains(e.target) || helpIcon.contains(e.target);
      if (!clickedInside) {
        tooltip.classList.add('hidden');
        helpIcon.setAttribute('aria-expanded', 'false');
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tooltip.classList.contains('hidden')) {
      tooltip.classList.add('hidden');
      helpIcon.setAttribute('aria-expanded', 'false');
    }
  });
}

// ===== רנדר ראשון =====
loadSettingsToForm();
draw();
