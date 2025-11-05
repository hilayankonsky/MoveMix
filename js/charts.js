import { minutesByTypePeriod, weeklyAggregates } from './stats.js';

let pie, bar;

export function refreshCharts(){
  // --- PIE by period (week|month) ---
  const period = document.getElementById('piePeriod')?.value || 'week';
  const { map } = minutesByTypePeriod(period);
  const ctxPie = document.getElementById('pieByType');
  const dataPie = { labels: Object.keys(map).map(m=>labelOf(m)), datasets:[{ data:Object.values(map) }] };
  if(pie) pie.destroy();
  pie = new Chart(ctxPie, { type:'pie', data:dataPie, options:{ plugins:{legend:{position:'bottom'}} } });

//   // --- Weekly bar across history (כמו שהיה) ---
//   const byWeek = weeklyAggregates();
//   const labels = Object.keys(byWeek).sort();
//   const minutes = labels.map(k=>byWeek[k].minutes);
//   const ctxBar = document.getElementById('barMinutesWeekly');
//   if(bar) bar.destroy();
//   bar = new Chart(ctxBar, { type:'bar', data:{ labels, datasets:[{ label:'דקות לשבוע', data: minutes }] }, options:{ plugins:{legend:{display:false}} } });
}

function labelOf(type){
  return ({tennis:'טניס',strength:'כוח',pilates:'פילאטיס',yoga:'יוגה',other:'אחר'})[type]||type;
}
