// Part of menu.html. Video tip: the "Video tip" button in the menu opens the animated how-to in a centered dialog.
(function () {
  const scrim = document.getElementById('vtScrim'), open = document.getElementById('videoTip'), close = document.getElementById('vtClose');
  if (!scrim || !open) return;
  let last = null;
  const show = () => {
    last = document.activeElement;
    scrim.hidden = false;                       // display:none -> grid restarts the animation from 0:00
    requestAnimationFrame(() => requestAnimationFrame(() => scrim.classList.add('show')));
    close.focus({ preventScroll: true });
  };
  const hide = () => {
    scrim.classList.remove('show');
    setTimeout(() => { scrim.hidden = true; if (last && last.focus) last.focus({ preventScroll: true }); }, 260);
  };
  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  scrim.addEventListener('click', e => { if (e.target === scrim) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !scrim.hidden) hide(); });
})();
