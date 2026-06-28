import { state } from './state.js';
import { pad } from './utils.js';
import { openModal } from './ui.js';

export function showCalendar() {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function renderCalendar(y, m) {
    const map = new Map();
    state.instruments.forEach((item) => {
      if (!item.valid_until) return;
      if (!map.has(item.valid_until)) map.set(item.valid_until, []);
      map.get(item.valid_until).push(item);
    });

    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date();

    let grid = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      .map((d) => '<div class="day header">' + d + '</div>').join('');

    for (let i = 0; i < offset; i++) grid += '<div></div>';

    for (let d = 1; d <= days; d++) {
      const key = y + '-' + pad(m + 1) + '-' + pad(d);
      const events = map.get(key) || [];
      const isToday = (y === today.getFullYear() && m === today.getMonth() && d === today.getDate());
      let classes = 'day';
      if (isToday) classes += ' today';
      if (events.length) classes += ' event';
      const title = events.map((i) => i.name).join(', ');
      const click = events.length ? `onclick="window._showEvents('${key}')"` : '';
      grid += `<div class="${classes}" ${click} title="${title}">${d}</div>`;
    }
    return grid;
  }

  function renderMonth(y, m) {
    const monthName = new Date(y, m).toLocaleString('ru', { month: 'long', year: 'numeric' });
    const grid = renderCalendar(y, m);
    return `
      <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <button class="secondary" data-cal-prev>◀</button>
        <span style="font-weight:bold; font-size:18px;">${monthName}</span>
        <button class="secondary" data-cal-next>▶</button>
      </div>
      <div class="calendar-grid">${grid}</div>
    `;
  }

  window._showEvents = (dateStr) => {
    const instruments = state.instruments.filter((inst) => inst.valid_until === dateStr);
    if (!instruments.length) return;
    const list = instruments.map((i) =>
      `<div class="row"><span>#${i.id} ${i.name}</span><span class="badge ok">срок истекает</span></div>`
    ).join('');
    openModal(`Приборы с истекающим сроком (${dateStr})`, `<div class="list">${list}</div>`);
  };

  const content = renderMonth(currentYear, currentMonth);
  openModal('Календарь поверок', content);

  const modal = document.getElementById('modal');
  const head = modal.querySelector('.modal-head');

  function updateCalendar() {
    const body = modal.querySelector('.modal-body');
    const children = body.children;
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i] !== head) children[i].remove();
    }
    const temp = document.createElement('div');
    temp.innerHTML = renderMonth(currentYear, currentMonth);
    while (temp.firstChild) body.appendChild(temp.firstChild);
    bindCalEvents();
  }

  function bindCalEvents() {
    const p = modal.querySelector('[data-cal-prev]');
    const n = modal.querySelector('[data-cal-next]');
    if (p) p.onclick = () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } updateCalendar(); };
    if (n) n.onclick = () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } updateCalendar(); };
  }

  bindCalEvents();
}
