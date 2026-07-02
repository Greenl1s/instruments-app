import { state } from './state.js';
import { pad } from './utils.js';
import { openModal, closeModal } from './ui.js';

export function showCalendar() {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function renderCalendar(y, m) {
    // Карта для сроков поверки
    const verificationMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.valid_until) return;
      if (!verificationMap.has(item.valid_until)) verificationMap.set(item.valid_until, []);
      verificationMap.get(item.valid_until).push(item);
    });

    // Карта для бронирований
    const bookedMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.booked_by || !item.booked_date) return;
      if (!bookedMap.has(item.booked_date)) bookedMap.set(item.booked_date, []);
      bookedMap.get(item.booked_date).push(item);
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
      const verificationEvents = verificationMap.get(key) || [];
      const bookedEvents = bookedMap.get(key) || [];
      const isToday = (y === today.getFullYear() && m === today.getMonth() && d === today.getDate());
      
      let classes = 'day';
      if (isToday) classes += ' today';
      if (verificationEvents.length) classes += ' event';
      if (bookedEvents.length) classes += ' booked';
      
      let click = '';
      const titles = [];
      if (verificationEvents.length) titles.push('Поверка: ' + verificationEvents.map(i => i.name).join(', '));
      if (bookedEvents.length) titles.push('Бронь: ' + bookedEvents.map(i => i.name + ' (' + i.booked_by + ')').join(', '));
      
      if (verificationEvents.length || bookedEvents.length) {
        const dateStr = key;
        click = `onclick="window._showDayEvents('${dateStr}')"`;
      }
      
      grid += `<div class="${classes}" ${click} title="${titles.join('; ')}">${d}</div>`;
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

  window._showDayEvents = (dateStr) => {
    // Получаем приборы с поверкой и бронированием на эту дату
    const instruments = state.instruments.filter((inst) => {
      return inst.valid_until === dateStr || (inst.booked_date === dateStr && inst.booked_by);
    });
    if (!instruments.length) return;
    
    let listHtml = '';
    instruments.forEach((inst) => {
      let info = `#${inst.id} ${inst.name}`;
      if (inst.booked_date === dateStr && inst.booked_by) {
        info += ` (забронирован: ${inst.booked_by})`;
      } else if (inst.valid_until === dateStr) {
        info += ` (срок поверки)`;
      }
      listHtml += `<div class="row"><span>${info}</span></div>`;
    });
    
    openModal(`События на ${dateStr}`, `<div class="list">${listHtml}</div>`);
  };

  const content = renderMonth(currentYear, currentMonth);
  openModal('Календарь', content);

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
