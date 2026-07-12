import { Unit } from '../../src/core/unit';
import { xnew } from '../../src/core/xnew';
import { AcademicCap } from '../../src/icons/AcademicCap';

describe('icons AcademicCap', () => {
    beforeEach(() => {
        Unit.reset();
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
    });

    it('nests an <svg> with the heroicons 24 viewBox and one outline path by default', () => {
        const unit = xnew(AcademicCap);
        const svg = unit.element as SVGSVGElement;

        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(svg.querySelectorAll('path').length).toBe(1);
    });

    it('renders the solid variant with its three filled paths', () => {
        const unit = xnew(AcademicCap, { mode: 'solid' });

        expect(unit.element.querySelectorAll('path').length).toBe(3);
    });

    it('injects an @layer base rule referencing currentColor for the active mode', () => {
        const unit = xnew(AcademicCap, { mode: 'solid' });
        const styleText = Array.from(document.head.querySelectorAll('style')).map((s) => s.textContent).join('');
        const generated = (unit.element as SVGSVGElement).getAttribute('class')?.split(' ')[0] ?? '';

        expect(generated).not.toBe('');
        expect(styleText).toContain('@layer base');
        expect(styleText).toContain(`.${generated}`);
        expect(styleText).toContain('fill: currentColor;');
    });

    it('appends caller className / style onto the svg element', () => {
        const unit = xnew(AcademicCap, { mode: 'solid', className: 'size-8', style: 'opacity: 0.5;' });
        const svg = unit.element as SVGSVGElement;

        expect(svg.getAttribute('class')).toContain('size-8');
        expect(svg.getAttribute('style')).toContain('opacity: 0.5;');
    });
});
