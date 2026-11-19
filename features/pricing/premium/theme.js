(() => {
 let preference;
 try {
  preference = localStorage.getItem('fama-system-theme-v2');
 } catch {}
 const dark = preference === 'dark' ||
  (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.dataset.theme = dark ? 'dark' : 'light';
 document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
