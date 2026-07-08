//----------------------------------------------------------------------------------------------------
// styles — shared pseudo-scoped CSS definitions for the basics components
//
// One defs object shared by every basics component gives cross-file layout a single source of
// truth, and xnew.css dedupes it into a single ref-counted <style>.
//
// - sharedCss : defs for xnew.css — fill / overlay / touchArea / row / clickable / frame /
//               pale / hover / press / scroll / hiddenInput
//
// Usage: const cls = xnew.css(sharedCss); xnew.nest(`<div class="${cls.row} ${cls.clickable}">`);
//----------------------------------------------------------------------------------------------------

// translucent currentColor used for hover / fill accents
const paleColor = 'color-mix(in srgb, currentColor 20%, transparent)';

export const sharedCss = {
    fill: 'width: 100%; height: 100%;',
    overlay: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;',
    // pointer-operated surface for on-screen game controls
    touchArea: 'width: 100%; height: 100%; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; pointer-events: auto;',
    // one form row of a panel
    row: 'position: relative; height: 2em; margin: 0.125em 0; display: flex; align-items: center;',
    clickable: 'cursor: pointer; user-select: none;',
    frame: 'border: 1px solid currentColor; border-radius: 0.25em;',
    pale: `background: ${paleColor};`,
    hover: `&:hover { background: ${paleColor}; }`,
    press: '&:active { filter: brightness(0.5); }',
    // transparent track lets the surface behind show through, so the scrollbar blends into any background
    scroll: 'overflow-y: auto; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, currentColor 40%, transparent) transparent;',
    // hidden native control overlaid on a styled row to capture interaction
    hiddenInput: 'position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0;',
};
