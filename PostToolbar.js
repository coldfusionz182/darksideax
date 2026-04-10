// PostToolbar.js

export function initPostToolbar({
  textareaId = 'thread-content',
  hideBtnId = 'btn-hide-text',
  colorBtnId = 'btn-color',
  colorPaletteId = 'color-palette',
  linkBtnId = 'btn-link', // optional button you add in HTML
} = {}) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const hideBtn = document.getElementById(hideBtnId);
  const colorBtn = document.getElementById(colorBtnId);
  const palette = document.getElementById(colorPaletteId);
  const linkBtn = document.getElementById(linkBtnId);

  function wrapSelection(before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) return; // nothing selected

    const value = textarea.value;
    const selected = value.slice(start, end);

    textarea.value =
      value.slice(0, start) + before + selected + after + value.slice(end);

    const newStart = start + before.length;
    const newEnd = newStart + selected.length;
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
  }

  // [HIDDEN]...[/HIDDEN]
  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      wrapSelection('[HIDDEN]', '[/HIDDEN]');
    });
  }

  // Color palette + [color=#hex]...[/color]
  if (colorBtn && palette) {
    colorBtn.addEventListener('click', () => {
      const visible =
        palette.style.display && palette.style.display !== 'none';
      palette.style.display = visible ? 'none' : 'grid';
    });

    palette.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      const color = btn.getAttribute('data-color');
      wrapSelection(`[color=${color}]`, '[/color]');
      palette.style.display = 'none';
    });
  }

  // Hyperlink [url=...]...[/url]
  if (linkBtn) {
    linkBtn.addEventListener('click', () => {
      const url = window.prompt('Enter URL (include http/https):');
      if (!url) return;
      wrapSelection(`[url=${url}]`, '[/url]');
    });
  }
}