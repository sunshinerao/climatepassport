const $ = (selector) => document.querySelector(selector);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const openers = new WeakMap();
function show(id) {
  const dialog = document.getElementById(id);
  if (!dialog || dialog.open) return;
  openers.set(dialog, document.activeElement);
  document.activeElement?.setAttribute('aria-expanded', 'true');
  dialog.showModal();
}
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => show(button.dataset.open)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  const heading = dialog.querySelector('h2');
  heading.id = `${dialog.id}-title`;
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.addEventListener('close', () => {
    const opener = openers.get(dialog);
    opener?.setAttribute('aria-expanded', 'false');
    opener?.focus();
  });
});
const tabs = [...document.querySelectorAll('[data-tab]')];
function selectTab(tab, updateHash = false) {
  tabs.forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
  if (updateHash) history.replaceState(null, '', `#${tab.dataset.tab}`);
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => selectTab(tab, true));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); selectTab(tabs[next], true); event.preventDefault();
  });
});
function applyHash() {
  const tab = tabs.find(button => button.dataset.tab === location.hash.slice(1)) || tabs[0];
  if (tab) selectTab(tab);
}
applyHash(); window.addEventListener('hashchange', applyHash);
document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
  const active = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '已收藏 · 仅本次演示' : '收藏活动';
}));
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const feedback = form.querySelector('.feedback');
  feedback.textContent = '预览完成。此设计稿不提交报名、不保存资料。';
  if (!reduceMotion.matches) feedback.animate([{opacity:.5,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});
}));
// One observer changes the stable header state; no scroll handler or layout polling.
const header = $('header');
const sentinel = document.createElement('span');
sentinel.setAttribute('aria-hidden', 'true'); sentinel.className = 'header-sentinel';
header.before(sentinel);
if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);
const currentPage = location.pathname.split('/').pop() || 'index.html';
$('#navigation nav')?.querySelectorAll('a').forEach(link => {
  if (link.getAttribute('href') === currentPage) link.setAttribute('aria-current', 'page');
});
