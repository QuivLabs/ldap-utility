/* Apply the saved appearance before paint. Only UI preferences are persisted. */
(() => {
  let preference = 'system';
  let collapsed = false;
  try {
    preference = localStorage.getItem('ldif-appearance') || 'system';
    collapsed = localStorage.getItem('ldif-navigation') === 'collapsed';
  } catch { /* Storage can be unavailable for local files or private browsing. */ }
  if (!['light', 'dark', 'system'].includes(preference)) preference = 'system';
  document.documentElement.dataset.appearance = preference;
  document.documentElement.dataset.theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  document.documentElement.classList.toggle('rail-collapsed', collapsed);
})();
