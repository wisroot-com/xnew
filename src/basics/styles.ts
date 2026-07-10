//----------------------------------------------------------------------------------------------------
// styles — shared pseudo-scoped CSS definitions for the basics components
//
// Only small, self-contained utilities live here; anything layout- or component-specific is
// inlined (or defined locally) by the component itself. xnew.css dedupes the defs into a single
// ref-counted <style>.
//
// - sharedCss : defs for xnew.css — fill / clickable / frame / pale / hover / scroll
//
// Usage: const cls = xnew.css(sharedCss); xnew.nest(`<div class="${cls.clickable} ${cls.hover}">`);
//----------------------------------------------------------------------------------------------------

// translucent currentColor used for hover / fill accents
const paleColor = 'color-mix(in srgb, currentColor 20%, transparent)';

export const sharedCss = {
    fill: 'width: 100%; height: 100%;',
    clickable: 'cursor: pointer; user-select: none;',
    frame: 'border: 1px solid currentColor; border-radius: 0.25em;',
    pale: `background: ${paleColor};`,
    hover: `&:hover { background: ${paleColor}; }`,
    // transparent track lets the surface behind show through, so the scrollbar blends into any background
    scroll: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;',
};
