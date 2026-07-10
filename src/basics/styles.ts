//----------------------------------------------------------------------------------------------------
// styles — shared pseudo-scoped CSS definitions for the basics components
//
// Only small, self-contained utilities live here; anything layout- or component-specific is
// inlined (or defined locally) by the component itself. xnew.css dedupes the defs into a single
// ref-counted <style>.
//
// - sharedCss : defs for xnew.css — fill / clickable / frame / tint / hoverTint / focusTint / press / scroll
//
// Usage: const cls = xnew.css(sharedCss); xnew.nest(`<div class="${cls.clickable} ${cls.hoverTint}">`);
//----------------------------------------------------------------------------------------------------

// translucent currentColor laid over the background as a tint
const tintColor = 'color-mix(in srgb, currentColor 20%, transparent)';

export const sharedCss = {
    fill: 'box-sizing: border-box; width: 100%; height: 100%;',
    clickable: 'cursor: pointer; user-select: none;',
    frame: 'border: 1px solid currentColor; border-radius: 0.25em;',
    tint: `background: ${tintColor};`,
    hoverTint: `&:hover { background: ${tintColor}; }`,
    focusTint: `&:focus { background: ${tintColor}; }`,
    press: '&:active { filter: brightness(0.5); }',
    // transparent track lets the surface behind show through, so the scrollbar blends into any background
    scroll: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;',
};
