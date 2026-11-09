import { createDemoAgendaFetch, readDemoBookings } from './demo-agenda.js';

const nativeApp = globalThis.Capacitor?.Plugins?.App;
if (nativeApp) {
  nativeApp.addListener('backButton', ({ canGoBack }) => {
    const closeDialog = document.querySelector('dialog[open] [data-booking-close]');
    const closeMenu = document.querySelector('.menu-open #drawerClose');
    if (closeDialog) closeDialog.click();
    else if (closeMenu) closeMenu.click();
    else if (canGoBack) window.history.back();
    else nativeApp.exitApp();
  });
}

let storage;
try {
  storage = window.localStorage;
} catch {
  // Reading remains available. The demo reports a local error if it cannot save.
}

if (document.querySelector('[data-booking-form]')) {
  const [{ initPublicAgenda }, { createPublicAgendaApi }] = await Promise.all([
    import('./agenda/js/main.js'),
    import('./agenda/js/api.js'),
  ]);
  const fetchImpl = createDemoAgendaFetch({ storage });
  initPublicAgenda({ api: createPublicAgendaApi({ fetchImpl }), demo: true });
}

const list = document.querySelector('[data-demo-bookings]');
if (list) {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const renderBookings = () => {
    list.replaceChildren();
    const bookings = readDemoBookings(storage).sort((left, right) => (
      left.date.localeCompare(right.date) || left.time.localeCompare(right.time)
    ));
    document.querySelector('[data-no-bookings]').hidden = bookings.length > 0;
    for (const booking of bookings) {
      const item = document.createElement('li');
      const procedure = document.createElement('h2');
      const details = document.createElement('p');
      const time = document.createElement('p');
      procedure.textContent = booking.procedureName;
      details.textContent = booking.professionalName;
      time.textContent = `${dateLabel.format(new Date(`${booking.date}T12:00:00Z`))} · ${booking.time}`;
      item.append(procedure, details, time);
      list.append(item);
    }
  };
  renderBookings();
  window.addEventListener('pageshow', renderBookings);
}
