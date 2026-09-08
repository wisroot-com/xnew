//----------------------------------------------------------------------------------------------------
// css — pseudo-scoped CSS backing xnew.css (local names → unique generated names)
// Scoping is emulated by renaming and made mandatory: a string def is a class body, an at-rule def
// declares its kind as { rule, body } — either way every rule hangs off a renamed key.
//----------------------------------------------------------------------------------------------------

import { Unit } from './unit';

// string = class declaration body; at-rules declare their kind ('@font-face' may list one body per face)
export type CssDef =
    | string
    | { rule: '@keyframes' | '@property' | '@counter-style', body: string }
    | { rule: '@font-face', body: string | string[] };

interface CssEntry { names: Record<string, string>; refs: number; style: HTMLStyleElement; }

const registry = new Map<string, CssEntry>();
let counter = 0;

const localName = /^[A-Za-z][A-Za-z0-9_-]*$/;
const layerName = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const atRules = ['@keyframes', '@property', '@counter-style', '@font-face'];

// '@property' names must be dashed idents, so its generated name (and every $reference to it) carries '--'
function generatedName(def: CssDef, prefix: string, name: string): string {
    if (typeof def === 'object' && def.rule === '@property') {
        return `--${prefix}${name}`;
    } else {
        return `${prefix}${name}`;
    }
}

// resolves $refs and enforces scoping in one pass: braces may not escape the wrapper, and string / comment content passes through untouched
function resolveBody(key: string, source: string, names: Record<string, string>): string {
    let out = '';
    let depth = 0;
    let i = 0;
    while (i < source.length) {
        const c = source[i];
        if (c === '/' && source[i + 1] === '*') {
            const end = source.indexOf('*/', i + 2);
            const next = end === -1 ? source.length : end + 2;
            out += source.slice(i, next);
            i = next;
        } else if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < source.length && source[j] !== c) {
                j += source[j] === '\\' ? 2 : 1;
            }
            const next = Math.min(j + 1, source.length);
            out += source.slice(i, next);
            i = next;
        } else if (c === '$' && /[A-Za-z]/.test(source[i + 1] ?? '')) {
            const ref = source.slice(i + 1).match(/^[A-Za-z][A-Za-z0-9_-]*/)![0];
            if (Object.prototype.hasOwnProperty.call(names, ref) === false) {
                throw new Error(`xnew.css: unknown reference "$${ref}" in "${key}".`);
            }
            out += names[ref];
            i += 1 + ref.length;
        } else {
            if (c === '{') {
                depth++;
            } else if (c === '}') {
                depth--;
            }
            if (depth < 0) {
                throw new Error(`xnew.css: unbalanced braces in "${key}".`);
            }
            out += c;
            i++;
        }
    }
    if (depth !== 0) {
        throw new Error(`xnew.css: unbalanced braces in "${key}".`);
    }
    return out;
}

export function applyCss(unit: Unit, layer: string | undefined, defs: Record<string, CssDef>): Record<string, string> {
    if (globalThis.document?.head === undefined) {
        return Object.fromEntries(Object.entries(defs).map(([name, def]) => [name, generatedName(def, '', name)]));
    } else {
        const key = JSON.stringify([layer, defs]);
        let entry = registry.get(key);
        if (entry === undefined) {
            if (layer !== undefined && layerName.test(layer) === false) {
                throw new Error(`xnew.css: invalid layer "${layer}".`);
            }
            const id = counter++;
            const names: Record<string, string> = {};
            for (const [name, def] of Object.entries(defs)) {
                if (localName.test(name) === false) {
                    throw new Error(`xnew.css: invalid local name "${name}".`);
                } else if (typeof def === 'object' && atRules.includes(def.rule) === false) {
                    throw new Error(`xnew.css: unsupported rule "${def.rule}" in "${name}".`);
                } else if (typeof def === 'object' && Array.isArray(def.body) === true && def.rule !== '@font-face') {
                    throw new Error(`xnew.css: only @font-face may take multiple bodies ("${name}").`);
                } else {
                    names[name] = generatedName(def, `xnew${id}-`, name);
                }
            }
            const blocks = Object.entries(defs).map(([name, def]) => {
                if (typeof def === 'string') {
                    // a string body is always wrapped in the class rule, where a definition at-rule would nest invalidly
                    if (/^@(keyframes|property|counter-style|font-face)\b/.test(def.trim()) === true) {
                        throw new Error(`xnew.css: write "${name}" as { rule: '@…', body: '…' }.`);
                    }
                    return `.${names[name]} {\n${resolveBody(name, def, names)}\n}`;
                } else if (def.rule === '@font-face') {
                    // the scoped identity of a face is its family: the generated name is injected as the font-family descriptor
                    const bodies = Array.isArray(def.body) ? def.body : [def.body];
                    return bodies.map((body) => `@font-face {\nfont-family: ${names[name]};\n${resolveBody(name, body, names)}\n}`).join('\n');
                } else {
                    return `${def.rule} ${names[name]} {\n${resolveBody(name, def.body, names)}\n}`;
                }
            }).join('\n');
            const text = layer === undefined ? blocks : `@layer ${layer} {\n${blocks}\n}`;

            const style = document.createElement('style');
            style.textContent = text;
            document.head.appendChild(style);

            entry = { names, refs: 0, style };
            registry.set(key, entry);
        }

        const held = entry;
        held.refs++;
        unit.on('destroy', () => {
            held.refs--;
            if (held.refs === 0) {
                held.style.remove();
                registry.delete(key);
            }
        });
        return held.names;
    }
}
