import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';

describe('xnew.css', () => {
    beforeEach(() => { Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); });

    function styleElements(): HTMLStyleElement[] {
        return [...document.head.querySelectorAll('style')];
    }

    it('returns a unique class name per local key', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ frame: 'color: red;', icon: 'width: 16px;' });
        });
        expect(Object.keys(css)).toEqual(['frame', 'icon']);
        expect(css.frame).toMatch(/^xnew\d+-frame$/);
        expect(css.icon).toMatch(/^xnew\d+-icon$/);
        expect(css.frame).not.toBe(css.icon);
    });

    it('injects one <style> wrapping each body in its generated class, unlayered by default', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ frame: 'color: red;' });
        });
        const styles = styleElements();
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).not.toContain('@layer');
        expect(styles[0].textContent).toContain(`.${css.frame} {`);
        expect(styles[0].textContent).toContain('color: red;');
    });

    it('wraps the whole block in @layer when a layer is given', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css('xnew', { frame: 'color: red;' });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toMatch(/^@layer xnew \{/);
        expect(text).toContain(`.${css.frame} {`);
    });

    it('wraps every entry in one shared @layer block', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css('xnew', {
                frame: 'color: red;',
                plain: 'color: blue;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toMatch(new RegExp(`^@layer xnew \\{\\s*\\.${css.frame} \\{`));
        expect(text).toContain(`.${css.plain} {`);
    });

    it('emits a { rule, body } value as a scoped at-rule', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                turn: { rule: '@keyframes', body: 'to { transform: rotate(1turn); }' },
            });
        });
        const text = styleElements()[0].textContent!;
        expect(css.turn).toMatch(/^xnew\d+-turn$/);
        expect(text).toContain(`@keyframes ${css.turn} {`);
        expect(text).not.toContain(`.${css.turn}`);
    });

    it('resolves a $key reference to the generated name of that entry', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                turn: { rule: '@keyframes', body: 'to { transform: rotate(1turn); }' },
                box: 'animation: $turn 1s linear infinite;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toContain(`animation: ${css.turn} 1s linear infinite;`);
    });

    it('generates a dashed name for @property, so var($key) resolves correctly', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                accent: { rule: '@property', body: "syntax: '<color>'; inherits: false; initial-value: red;" },
                box: 'color: var($accent);',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(css.accent).toMatch(/^--xnew\d+-accent$/);
        expect(text).toContain(`@property ${css.accent} {`);
        expect(text).toContain(`color: var(${css.accent});`);
    });

    it('injects the generated name as font-family into each @font-face body', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                pixel: { rule: '@font-face', body: [
                    'src: url(pixel.woff2); font-weight: 400;',
                    'src: url(pixel-bold.woff2); font-weight: 700;',
                ] },
                label: 'font-family: $pixel;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(css.pixel).toMatch(/^xnew\d+-pixel$/);
        expect(text.match(/@font-face \{/g)).toHaveLength(2);
        expect(text.match(new RegExp(`font-family: ${css.pixel};`, 'g'))).toHaveLength(3);
        expect(text).toContain('src: url(pixel-bold.woff2);');
    });

    it('emits a scoped @counter-style rule', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                marker: { rule: '@counter-style', body: 'system: cyclic; symbols: "▸"; suffix: " ";' },
                list: 'list-style: $marker;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toContain(`@counter-style ${css.marker} {`);
        expect(text).toContain(`list-style: ${css.marker};`);
    });

    it('wraps a string body starting with a nested conditional at-rule as a class rule', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                frame: '@media (max-width: 600px) { color: blue; } color: red;',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toContain(`.${css.frame} {`);
        expect(text).toContain('@media (max-width: 600px) { color: blue; }');
    });

    it('throws on an unsupported rule', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ box: { rule: '@media', body: 'color: red;' } as any });
            });
        }).toThrow('unsupported rule "@media"');
    });

    it('throws on multiple bodies outside @font-face', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ turn: { rule: '@keyframes', body: ['to { top: 0; }', 'to { top: 1px; }'] } as any });
            });
        }).toThrow('only @font-face may take multiple bodies');
    });

    it('throws on an unknown $key reference', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ box: 'animation: $missing 1s;' });
            });
        }).toThrow('unknown reference "$missing"');
    });

    it('throws on a key that is not a plain local name', () => {
        for (const name of ['.global', '@keyframes spin', 'a b', '*']) {
            expect(() => {
                xnew(() => {
                    xnew.css({ [name]: 'color: red;' });
                });
            }).toThrow('invalid local name');
        }
    });

    it('throws on a string body written as a definition at-rule (scoping must hold)', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ turn: '@keyframes spin { to { transform: rotate(1turn); } }' });
            });
        }).toThrow(`write "turn" as { rule: '@…', body: '…' }`);
    });

    it('throws when a body escapes its braces (no global rule can be emitted)', () => {
        for (const body of ['} body { background: red; } .x {', 'color: red; }', '@media (x) { color: red;']) {
            expect(() => {
                xnew(() => {
                    xnew.css({ evil: body });
                });
            }).toThrow('unbalanced braces');
        }
    });

    it('throws on a $reference to an inherited object property', () => {
        expect(() => {
            xnew(() => {
                xnew.css({ box: 'width: $constructor;' });
            });
        }).toThrow('unknown reference "$constructor"');
    });

    it('leaves $words inside strings and comments untouched', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({
                frame: 'color: red;',
                label: 'content: "$frame"; /* see $frame */',
            });
        });
        const text = styleElements()[0].textContent!;
        expect(text).toContain('content: "$frame"; /* see $frame */');
    });

    it('throws on an invalid layer (injection is rejected)', () => {
        expect(() => {
            xnew(() => {
                xnew.css('x } body { color: red; }', { bad: 'color: red;' });
            });
        }).toThrow('invalid layer');
    });

    it('leaves attribute selectors like [href$="…"] untouched', () => {
        let css!: Record<string, string>;
        xnew(() => {
            css = xnew.css({ link: '&[href$=".png"] { color: red; }' });
        });
        expect(styleElements()[0].textContent).toContain('[href$=".png"]');
        expect(Object.keys(css)).toEqual(['link']);
    });

    it('keeps layered and unlayered definitions of the same body separate', () => {
        let plain!: Record<string, string>, layered!: Record<string, string>;
        xnew(() => { plain = xnew.css({ frame: 'color: red;' }); });
        xnew(() => { layered = xnew.css('xnew', { frame: 'color: red;' }); });
        expect(styleElements()).toHaveLength(2);
        expect(layered.frame).not.toBe(plain.frame);
    });

    it('shares one <style> and the same names across units with an identical definition', () => {
        const defs = { frame: 'color: red;' };
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = xnew.css(defs); });
        xnew(() => { b = xnew.css(defs); });
        expect(styleElements()).toHaveLength(1);
        expect(b.frame).toBe(a.frame);
    });

    it('generates distinct names for different definitions with the same local key', () => {
        let a!: Record<string, string>, b!: Record<string, string>;
        xnew(() => { a = xnew.css({ frame: 'color: red;' }); });
        xnew(() => { b = xnew.css({ frame: 'color: blue;' }); });
        expect(styleElements()).toHaveLength(2);
        expect(b.frame).not.toBe(a.frame);
    });

    it('removes the <style> only when the last unit using the definition finalizes', () => {
        const defs = { frame: 'color: red;' };
        const first = xnew(() => { xnew.css(defs); });
        const second = xnew(() => { xnew.css(defs); });

        first.finalize();
        expect(styleElements()).toHaveLength(1);

        second.finalize();
        expect(styleElements()).toHaveLength(0);
    });

    it('reuses the removed definition by injecting a fresh <style>', () => {
        const defs = { frame: 'color: red;' };
        const first = xnew(() => { xnew.css(defs); });
        first.finalize();
        expect(styleElements()).toHaveLength(0);

        xnew(() => { xnew.css(defs); });
        expect(styleElements()).toHaveLength(1);
    });

    it('works outside initialization (in a deferred callback)', () => {
        let css!: Record<string, string>;
        const unit = xnew(() => {});
        Unit.scope(unit._.lastSnapshot!, () => {
            css = xnew.css({ late: 'color: green;' });
        });
        expect(css.late).toMatch(/^xnew\d+-late$/);
        expect(styleElements()).toHaveLength(1);

        unit.finalize();
        expect(styleElements()).toHaveLength(0);
    });
});
