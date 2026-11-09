/**
 * Preview Switcher Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const switchBtns = document.querySelectorAll('.switch-btn');
  const stageFrames = document.querySelectorAll('.stage-frame');

  switchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchBtns.forEach(b => b.classList.remove('active'));
      stageFrames.forEach(f => f.classList.remove('active'));

      btn.classList.add('active');
      const view = btn.getAttribute('data-view');
      const targetFrame = document.getElementById(`frame-${view}`);
      if (targetFrame) {
        targetFrame.classList.add('active');
      }
    });
  });
});
