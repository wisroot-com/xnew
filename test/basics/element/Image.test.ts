import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { Image } from '../../../src/basics/element/Image';

describe('basics Image', () => {
    // jsdom does not implement object URLs — stub them
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let createObjectURL: jest.Mock;
    let revokeObjectURL: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        Unit.reset();
        createObjectURL = jest.fn(() => 'blob:mock');
        revokeObjectURL = jest.fn();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
    });
    afterEach(() => {
        Unit.engineRoot?.finalize();
        jest.useRealTimers();
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    });

    it('nests an <img> and sets a string src directly', () => {
        const unit = xnew(Image, { src: './a.png', className: 'bg', style: 'opacity: 0.5;' });
        const img = unit.element as HTMLImageElement;

        expect(img.tagName).toBe('IMG');
        expect(img.getAttribute('src')).toBe('./a.png');
        expect(img.className).toBe('bg');
        expect(img.getAttribute('style')).toContain('opacity: 0.5;');
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('converts a Blob src to an object URL', () => {
        const blob = new Blob(['x'], { type: 'image/png' });
        const unit = xnew(Image, { src: blob });

        expect(createObjectURL).toHaveBeenCalledWith(blob);
        expect((unit.element as HTMLImageElement).getAttribute('src')).toBe('blob:mock');
    });

    it('wraps raw binary in a Blob before creating the object URL', () => {
        xnew(Image, { src: new Uint8Array([1, 2, 3]) });

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    });

    it('applies a Promise src (binary) after it resolves', async () => {
        const unit = xnew(Image, { src: Promise.resolve(new Blob(['x'])) });
        const img = unit.element as HTMLImageElement;
        expect(img.getAttribute('src')).toBe(null);

        await jest.advanceTimersByTimeAsync(0);

        expect(img.getAttribute('src')).toBe('blob:mock');
    });

    it('applies a Promise src (string) after it resolves', async () => {
        const unit = xnew(Image, { src: Promise.resolve('./b.png') });

        await jest.advanceTimersByTimeAsync(0);

        expect((unit.element as HTMLImageElement).getAttribute('src')).toBe('./b.png');
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('revokes the object URL on finalize', () => {
        const unit = xnew(Image, { src: new Blob(['x']) });
        unit.finalize();

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });

    it('does not revoke when the src was a plain string', () => {
        const unit = xnew(Image, { src: './a.png' });
        unit.finalize();

        expect(revokeObjectURL).not.toHaveBeenCalled();
    });
});
