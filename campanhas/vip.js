import { VIP_GROUP_INVITE_URL } from './vip-config.js?v=20261106-convite2';

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
  let count = 0;
  document.querySelectorAll('[data-vip-join], [data-vip-link]').forEach(element => {
    if (!url) {
      if (element.tagName === 'BUTTON') return;
      const button = document.createElement('button');
      button.className = element.className;
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('disabled', '');
      button.setAttribute('data-vip-join', '');
      button.setAttribute('aria-describedby', 'vip-status vip-privacy');
      button.append(...element.childNodes);
      element.replaceWith(button);
      return;
    }
    const isLink = element.tagName === 'A';
    const link = isLink ? element : document.createElement('a');
    if (!isLink) {
      link.className = element.className;
      link.append(...element.childNodes);
      element.replaceWith(link);
    }
    if (!isLink || link.getAttribute('href') !== url) count += 1;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-describedby', 'vip-privacy');
    link.setAttribute('data-vip-link', '');
  });
  document.querySelectorAll('[data-vip-pending]').forEach(el => { el.hidden = Boolean(url); });
  return count;
}

if (typeof document !== 'undefined') activateVipLinks(document);
