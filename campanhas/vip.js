import { VIP_GROUP_INVITE_URL } from './vip-config.js';

export function safeGroupInvite(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com') return null;
    if (url.username || url.password || url.port || url.hash) return null;
    if (!/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function activateVipLinks(document, invite = VIP_GROUP_INVITE_URL) {
  const url = safeGroupInvite(invite);
  if (!url) return 0;
  let count = 0;
  document.querySelectorAll('button[data-vip-join]').forEach(button => {
    const link = document.createElement('a');
    link.className = button.className;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-describedby', 'vip-privacy');
    link.setAttribute('data-vip-link', '');
    link.append(...button.childNodes);
    button.replaceWith(link);
    count += 1;
  });
  if (count) document.querySelectorAll('[data-vip-pending]').forEach(el => { el.hidden = true; });
  return count;
}

if (typeof document !== 'undefined') activateVipLinks(document);
