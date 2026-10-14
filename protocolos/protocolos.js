export function hydrateProtocolVideo(video) {
  if (!video || video.dataset.hydrated === 'true') return;

  let changed = false;
  video.querySelectorAll('source[data-src]').forEach((source) => {
    const src = source.dataset.src;
    if (!src) return;
    source.src = src;
    source.removeAttribute('data-src');
    changed = true;
  });

  if (!changed) return;
  video.dataset.hydrated = 'true';
  video.load();
}

export function canAutoplayProtocolVideo(reducedMotion, video) {
  return Boolean(video && !reducedMotion && video.muted);
}

export function initProtocolVideos(root = document) {
  const cards = [...root.querySelectorAll('[data-protocol-video][data-video-state="ready"]')];
  if (!cards.length) return;

  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hydrateCard = (card) => {
    const video = card.querySelector('video');
    if (video) hydrateProtocolVideo(video);
    return video;
  };

  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    cards.forEach(hydrateCard);
    return;
  }

  const preloadObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      hydrateCard(entry.target);
      preloadObserver.unobserve(entry.target);
    });
  }, { rootMargin: '300px 0px' });

  const playbackObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector('video');
      if (!video) return;

      if (entry.isIntersecting
        && entry.intersectionRatio >= 0.55
        && canAutoplayProtocolVideo(reducedMotion, video)) {
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') playback.catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: [0, 0.55, 1] });

  cards.forEach((card) => {
    preloadObserver.observe(card);
    playbackObserver.observe(card);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initProtocolVideos(), { once: true });
  } else {
    initProtocolVideos();
  }
}
