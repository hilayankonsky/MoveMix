// js/stats.js

import { getAll } from './storage.js';
import { weekKey } from './date.js';

/**
 * פירוש תאריך "YYYY-MM-DD" כתאריך מקומי יציב (12:00)
 * כדי להימנע מהחלקות אזור זמן ושעון קיץ/חורף.
 */
function localNoon(dateStr){
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * טווח השבוע הנוכחי: א' 00:00 → ש' 23:59:59
 * (JS: Sunday=0, Monday=1, ... — וזה מתאים לשבוע ישראלי שמתחיל בא')
 */
export function weekRangeNow(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const dow = start.getDay(); // 0 = Sunday
  start.setDate(start.getDate() - dow);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

/**
 * טווח החודש הנוכחי: יום 1 00:00 → יום אחרון 23:59:59
 */
export function monthRangeNow(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999); // יום 0 של החודש הבא = יום האחרון בחודש הנוכחי
  return { start, end };
}

/**
 * חישוב קלוריות לאימון אחד:
 * אם הוזנו ידנית (מהשעון) — עדיפות לזה;
 * אחרת חישוב לפי MET * משקל * דקות / 60.
 */


/**
 * מחשבת קלוריות עבור אימון יחיד.
 * עדיפות:
 * 1. ערך ידני
 * 2. ערך קבוע בזמן הרישום
 * 3. חישוב לפי ההגדרות הנוכחיות (לתאימות לאחור)
 */
export function caloriesFor(session) {
  // 1. אם יש ערך ידני → זה הערך
  if (typeof session.caloriesManual === 'number' && !Number.isNaN(session.caloriesManual)) {
    return Math.round(session.caloriesManual);
  }

  // 2. אם נשמר ערך קבוע בזמן הרישום → משתמשים בו
  if (typeof session.caloriesFixed === 'number' && !Number.isNaN(session.caloriesFixed)) {
    return session.caloriesFixed;
  }

  // 3. תאימות לאחור: אם לא נשמרו שדות חדשים, נחשב לפי המשקל הנוכחי
  const state = getAll();
  const w = state.settings?.weightKg;
  if (!w) return 0;
  const met = state.settings?.MET?.[session.type] ?? session.metAtLog ?? 3.0;
  return Math.round(met * w * ((session.durationMin || 0) / 60));
}


/**
 * צבירה שבועית לאורך כל ההיסטוריה (לגרף העמודות "דקות לשבוע")
 * המפתח הוא YYYY-Www (בערך), ע"פ weekKey.
 */
export function weeklyAggregates(){
  const { sessions } = getAll();
  const byWeek = {};
  for(const s of sessions){
    const wk = weekKey(s.date);
    if(!byWeek[wk]) byWeek[wk] = { minutes: 0, calories: 0 };
    byWeek[wk].minutes += (s.durationMin || 0);
    byWeek[wk].calories += caloriesFor(s);
  }
  return byWeek;
}

/**
 * חלוקת דקות לפי סוג — בכל ההיסטוריה (שימושי אם צריך)
 */
export function minutesByType(){
  const { sessions } = getAll();
  const map = { tennis:0, strength:0, pilates:0, yoga:0, other:0 };
  for(const s of sessions){
    map[s.type] = (map[s.type]||0) + (s.durationMin||0);
  }
  return map;
}

/**
 * חלוקת דקות לפי סוג — לתקופה נוכחית (שבוע או חודש)
 * period: 'week' | 'month'
 */
export function minutesByTypePeriod(period){
  const { sessions } = getAll();
  const { start, end } = period === 'month' ? monthRangeNow() : weekRangeNow();
  const map = { tennis:0, strength:0, pilates:0, yoga:0, other:0 };
  for(const s of sessions){
    const d = localNoon(s.date);
    if(d >= start && d <= end){
      map[s.type] = (map[s.type]||0) + (s.durationMin||0);
    }
  }
  return { map, range: { start, end } };
}

/**
 * KPI שבועי (אימונים + דקות) + טווח, בלי קלוריות (נחשב במיין לפי caloriesFor)
 */
export function kpisThisWeek(){
  const { sessions } = getAll();
  const { start, end } = weekRangeNow();
  let workouts = 0, minutes = 0;
  for(const s of sessions){
    const d = localNoon(s.date);
    if(d >= start && d <= end){
      workouts++;
      minutes += (s.durationMin || 0);
    }
  }
  return { workouts, minutes, range: { start, end } };
}

/**
 * KPI חודשי (אימונים + דקות) + טווח, בלי קלוריות (נחשב במיין לפי caloriesFor)
 */
export function kpisThisMonth(){
  const { sessions } = getAll();
  const { start, end } = monthRangeNow();
  let workouts = 0, minutes = 0;
  for(const s of sessions){
    const d = localNoon(s.date);
    if(d >= start && d <= end){
      workouts++;
      minutes += (s.durationMin || 0);
    }
  }
  return { workouts, minutes, range: { start, end } };
}
