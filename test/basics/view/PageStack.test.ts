import { Unit } from '../../../src/core/unit';
import { xnew } from '../../../src/core/xnew';
import { PageStack } from '../../../src/basics/view/PageStack';

describe('basics PageStack', () => {
    beforeEach(() => { jest.useFakeTimers({ now: 0 }); Unit.reset(); });
    afterEach(() => { Unit.engineRoot?.finalize(); jest.useRealTimers(); });

    const lifecycle = () => {
        const log: string[] = [];
        const track = (name: string) => (unit: xnew.Unit, props: any) => {
            log.push(`${name}:in(${props?.tag ?? ''})`);
            unit.on('finalize', () => log.push(`${name}:out`));
        };
        return { log, track };
    };

    it('mounts the root page on creation, with props via a [Component, props] entry', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack, { root: [track('Lobby'), { tag: 'io' }] });

        expect(log).toEqual(['Lobby:in(io)']);
        expect(nav.depth).toBe(1);
    });

    it('stays empty until the first push when no root is given', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack);

        expect(nav.depth).toBe(0);
        nav.push(track('Menu'));
        expect(log).toEqual(['Menu:in()']);
        expect(nav.depth).toBe(1);
    });

    it('push() finalizes the current page and stacks the new one', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack, { root: track('Lobby') });
        const changed = jest.fn();
        nav.on('-pagechange', changed);

        nav.push(track('Room'), { tag: 'r1' });

        expect(log).toEqual(['Lobby:in()', 'Lobby:out', 'Room:in(r1)']);
        expect(nav.depth).toBe(2);
        expect(changed).toHaveBeenCalledWith(expect.objectContaining({ depth: 2 }));
    });

    it('pop() recreates the previous page from its stored props', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack, { root: [track('Lobby'), { tag: 'io' }] });
        nav.push(track('Room'));

        nav.pop();

        expect(log).toEqual(['Lobby:in(io)', 'Lobby:out', 'Room:in()', 'Room:out', 'Lobby:in(io)']);
        expect(nav.depth).toBe(1);
    });

    it('pop() at the root is ignored', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack, { root: track('Lobby') });

        nav.pop();

        expect(log).toEqual(['Lobby:in()']);
        expect(nav.depth).toBe(1);
    });

    it('replace() swaps the current page without growing the history', () => {
        const { log, track } = lifecycle();
        const nav = xnew(PageStack, { root: track('Lobby') });
        nav.push(track('Room'));

        nav.replace(track('Settings'));
        expect(nav.depth).toBe(2);

        nav.pop();
        expect(log).toEqual(['Lobby:in()', 'Lobby:out', 'Room:in()', 'Room:out', 'Settings:in()', 'Settings:out', 'Lobby:in()']);
    });
});
