(() => {
  const storageKey = 'water-control-opening-played';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;
  try {
    if (sessionStorage.getItem(storageKey)) return;
  } catch {}

  const logoUrl = new URL('icon.webp', document.currentScript.src);

  async function showOpening() {
    const opening = document.createElement('div');
    opening.className = 'water-control-opening';
    opening.setAttribute('aria-hidden', 'true');
    opening.innerHTML = `
      <div class="water-control-opening-lockup">
        <span class="water-opening-mark"><img alt="" width="256" height="256"></span>
        <span class="water-control-opening-letters">
          <span class="water-control-opening-name">ater Control</span>
        </span>
        <span class="water-control-opening-gear-slot">
          <svg class="water-control-opening-gear" viewBox="0 0 24 24" fill="none"
            stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.44.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>
      </div>
    `;

    const logo = opening.querySelector('img');
    logo.src = logoUrl.href;
    try {
      await logo.decode();
    } catch {
      return;
    }
    if (reducedMotion.matches) return;

    document.body.append(opening);
    const lockup = opening.firstElementChild;
    const name = opening.querySelector('.water-control-opening-name');
    const fontSize = parseFloat(getComputedStyle(name).fontSize);
    const nameWidth = name.getBoundingClientRect().width;
    if (getComputedStyle(opening).position !== 'fixed' || !nameWidth || !fontSize) {
      opening.remove();
      return;
    }
    lockup.style.setProperty('--water-control-name-width', ((nameWidth + 1) / fontSize) + 'em');

    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {}
    const fallback = setTimeout(() => opening.remove(), 5000);
    opening.addEventListener('animationend', event => {
      if (event.target !== opening) return;
      clearTimeout(fallback);
      opening.remove();
    });
  }

  void showOpening();
})();
