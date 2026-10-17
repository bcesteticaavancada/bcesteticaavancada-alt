// One media element preserves audio preferences and loads only the selected video.
export function createProtocolPlaylist({ video, items, onChange = () => {}, onStatus = () => {} }) {
  let index = -1;
  let revision = 0;
  function select(nextIndex, { autoplay = !video.paused && !video.ended } = {}) {
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= items.length) return false;
    const request = ++revision;
    const item = items[nextIndex];
    video.pause();
    index = nextIndex;
    video.poster = item.poster;
    video.src = item.src;
    video.setAttribute('aria-label', `Vídeo: ${item.title}`);
    video.load();
    onStatus('');
    onChange(index);
    if (autoplay) {
      const blocked = () => {
        if (request === revision) onStatus('Toque em reproduzir para continuar.');
      };
      try {
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') playback.catch(blocked);
      } catch { blocked(); }
    }
    return true;
  }
  function ended() {
    if (index < items.length - 1) select(index + 1, { autoplay: true });
    else onStatus('Sequência concluída. Escolha um vídeo para assistir novamente.');
  }
  function failed() {
    onStatus('Não foi possível carregar. Tente reproduzir novamente ou escolha outro vídeo.');
  }
  video.addEventListener('ended', ended);
  video.addEventListener('error', failed);
  if (items.length) select(0, { autoplay: false });
  return {
    get index() { return index; },
    select,
    next: () => select(index + 1),
    previous: () => select(index - 1),
    destroy() {
      ++revision;
      video.pause();
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failed);
    },
  };
}

export function initProtocolVideos(root = document) {
  const player = root.querySelector('[data-protocol-player]');
  if (!player || player.dataset.initialized === 'true') return;
  const video = player.querySelector('video');
  const links = [...player.querySelectorAll('[data-protocol-video][data-video-state="ready"]')];
  if (!video || !links.length) return;
  player.dataset.initialized = 'true';
  const title = player.querySelector('[data-video-title]');
  const description = player.querySelector('[data-video-description]');
  const count = player.querySelector('[data-video-count]');
  const status = player.querySelector('[data-video-status]');
  const previous = player.querySelector('[data-video-previous]');
  const next = player.querySelector('[data-video-next]');
  const items = links.map((link) => ({
    src: link.getAttribute('href'), poster: link.dataset.poster,
    title: link.dataset.title, description: link.dataset.description,
  }));
  const playlist = createProtocolPlaylist({
    video, items,
    onChange(index) {
      title.textContent = items[index].title;
      description.textContent = items[index].description;
      count.textContent = `${index + 1} de ${items.length}`;
      previous.disabled = index === 0;
      next.disabled = index === items.length - 1;
      links.forEach((link, i) => {
        if (i === index) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    },
    onStatus(message) { status.textContent = message; },
  });
  links.forEach((link, index) => link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    playlist.select(index);
  }));
  previous.addEventListener('click', () => playlist.previous());
  next.addEventListener('click', () => playlist.next());
  player.querySelectorAll('[data-playlist-control]').forEach((control) => { control.hidden = false; });
  // Pause when the visitor scrolls to the catalogue or leaves the app.
  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) video.pause();
    });
    observer.observe(video);
  }
  root.addEventListener('visibilitychange', () => {
    if (root.hidden) video.pause();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initProtocolVideos(), { once: true });
  } else initProtocolVideos();
}
