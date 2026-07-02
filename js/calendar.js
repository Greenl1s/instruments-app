import { state } from './state.js';
import { pad } from './utils.js';
import { openModal } from './ui.js';

export function showCalendar() {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function renderCalendar(y, m) {
    // Карта для сроков поверки
    const verificationMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.valid_until) return;
      if (!verificationMap.has(item.valid_until)) verificationMap.set(item.valid_until, []);
      verificationMap.get(item.valid_until).push({ ...item, type: 'verification' });
    });

    // Карта для бронирований
    const bookedMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.booked_by || !item.booked_date) return;
      if (!bookedMap.has(item.booked_date)) bookedMap.set(item.booked_date, []);
      bookedMap.get(item.booked_date).push({ ...item, type: 'booked' });
    });

    // Карта для взятых приборов (по дате выдачи)
    const takenMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.taken_by || !item.taken_date) return;
      if (!takenMap.has(item.taken_date)) takenMap.set(item.taken_date, []);
      takenMap.get(item.taken_date).push({ ...item, type: 'taken' });
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
      const takenEvents = takenMap.get(key) || [];
      const isToday = (y === today.getFullYear() && m === today.getMonth() && d === today.getDate());
      
      let classes = 'day';
      if (isToday) classes += ' today';
      
      let hasVerification = verificationEvents.length > 0;
      let hasBooked = bookedEvents.length > 0;
      let hasTaken = takenEvents.length > 0;
      
      if (hasVerification) classes += ' event';
      if (hasBooked) classes += ' booked';
      if (hasTaken) classes += ' taken';
      // Если есть и бронь и поверка – добавляем класс both
      if (hasBooked && hasVerification) classes += ' both';
      
      let click = '';
      const allEvents = [...verificationEvents, ...bookedEvents, ...takenEvents];
      if (allEvents.length) {
        const dateStr = key;
        click = `onclick="window._showDayEvents('${dateStr}')"`;
      }
      
      // Формируем подсказку
      let titleParts = [];
      if (hasVerification) titleParts.push('Поверка: ' + verificationEvents.map(i => i.name).join(', '));
      if (hasBooked) titleParts.push('Бронь: ' + bookedEvents.map(i => i.name + ' (' + i.booked_by + ')').join(', '));
      if (hasTaken) titleParts.push('Взято: ' + takenEvents.map(i => i.name + ' (' + i.taken_by + ')').join(', '));
      
      grid += `<div class="${classes}" ${click} title="${titleParts.join('; ')}">${d}</div>`;
    }
    return grid;
  }

  function renderLegend() {
    return `
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #d9e0ea; justify-content:center;">
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:20px; height:20px; border-radius:4px; background:#dcfae6; border:1px solid #75e0a7;"></span>
          <span>Истекает срок поверки</span>
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:20px; height:20px; border-radius:4px; background:#fee2e2; border:1px solid #fda29b;"></span>
          <span>Забронирован</span>
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:20px; height:20px; border-radius:4px; background:#dbeafe; border:1px solid #93c5fd;"></span>
          <span>Взят (выдан)</span>
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:20px; height:20px; border-radius:4px; background:#fed7aa; border:1px solid #fb923c;"></span>
          <span>Бронь + истекает срок</span>
        </span>
      </div>
    `;
  }

  function renderMonth(y, m) {
    const monthName = new Date(y, m).toLocaleString('ru', { month: 'long', year: 'numeric' });
    const grid = renderCalendar(y, m);
    const legend = renderLegend();
    return `
      <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <button class="secondary" data-cal-prev>◀</button>
        <span style="font-weight:bold; font-size:18px;">${monthName}</span>
        <button class="secondary" data-cal-next>▶</button>
      </div>
      <div class="calendar-grid">${grid}</div>
      ${legend}
    `;
  }

  window._showDayEvents = (dateStr) => {
    // Собираем все события на дату с указанием типа
    const events = [];
    state.instruments.forEach((inst) => {
      if (inst.valid_until === dateStr) {
        events.push({ ...inst, eventType: 'Поверка' });
      }
      if (inst.booked_date === dateStr && inst.booked_by) {
        events.push({ ...inst, eventType: 'Бронирование', user: inst.booked_by });
      }
      if (inst.taken_date === dateStr && inst.taken_by) {
        events.push({ ...inst, eventType: 'Выдача', user: inst.taken_by });
      }
    });
    if (!events.length) return;
    
    let listHtml = '';
    events.forEach((inst) => {
      let info = `#${inst.id} ${inst.name}`;
      if (inst.eventType === 'Бронирование' || inst.eventType === 'Выдача') {
        info += ` (${inst.eventType}: ${inst.user})`;
      } else {
        info += ` (${inst.eventType})`;
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
    // Удаляем всё кроме заголовка
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
