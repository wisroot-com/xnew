import { MapSet, MapMap } from '../../src/utils/map';

describe('MapSet', () => {
    let mapSet: MapSet<string, number>;
    beforeEach(() => { mapSet = new MapSet<string, number>(); });

    describe('add / has', () => {
        it('stores values under a key', () => {
            mapSet.add('k', 1); mapSet.add('k', 2);
            expect(mapSet.has('k', 1)).toBe(true);
            expect(mapSet.has('k', 2)).toBe(true);
        });
        it('reports false for missing entries', () => {
            mapSet.add('k', 1);
            expect(mapSet.has('k', 99)).toBe(false);
            expect(mapSet.has('missing')).toBe(false);
        });
        it('reports true with a key-only argument when the inner set is non-empty', () => {
            mapSet.add('k', 1);
            expect(mapSet.has('k')).toBe(true);
        });
        it('returns itself for chaining', () => {
            expect(mapSet.add('k', 1)).toBe(mapSet);
        });
    });

    describe('delete', () => {
        it('removes a single value and reports whether it existed', () => {
            mapSet.add('k', 1); mapSet.add('k', 2);
            expect(mapSet.delete('k', 1)).toBe(true);
            expect(mapSet.has('k', 1)).toBe(false);
            expect(mapSet.has('k', 2)).toBe(true);
        });
        it('removes the outer entry once the inner set becomes empty', () => {
            mapSet.add('k', 1); mapSet.delete('k', 1);
            expect(mapSet.has('k')).toBe(false);
            expect(mapSet.size).toBe(0);
        });
        it('removes the whole entry when called with one argument', () => {
            mapSet.add('k', 1); mapSet.add('k', 2);
            expect(mapSet.delete('k')).toBe(true);
            expect(mapSet.has('k')).toBe(false);
            expect(mapSet.delete('k')).toBe(false);
        });
        it('returns false when nothing was removed', () => {
            expect(mapSet.delete('k', 1)).toBe(false);
            expect(mapSet.delete('missing')).toBe(false);
        });
    });

    describe('keys iteration', () => {
        it('iterates the outer keys', () => {
            mapSet.add('a', 1); mapSet.add('b', 2);
            expect([...mapSet.keys()].sort()).toEqual(['a', 'b']);
        });
        it('iterates the values held by a given key', () => {
            mapSet.add('a', 1); mapSet.add('a', 2); mapSet.add('a', 3);
            expect([...mapSet.keys('a')].sort()).toEqual([1, 2, 3]);
        });
        it('yields an empty iterator for a missing key', () => {
            expect([...mapSet.keys('missing')]).toEqual([]);
        });
    });

    describe('Map compatibility', () => {
        it('exposes size from the underlying Map', () => {
            mapSet.add('a', 1); mapSet.add('b', 2);
            expect(mapSet.size).toBe(2);
        });
        it('forEach visits each outer entry once', () => {
            mapSet.add('a', 1); mapSet.add('b', 2);
            const visitor = jest.fn();
            mapSet.forEach((_, key) => visitor(key));
            expect(visitor.mock.calls.flat().sort()).toEqual(['a', 'b']);
        });
    });
});

describe('MapMap', () => {
    let mapMap: MapMap<string, string, number>;
    beforeEach(() => { mapMap = new MapMap<string, string, number>(); });

    describe('set / get', () => {
        it('stores and retrieves nested values', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', 'b', 2);
            expect(mapMap.get('k', 'a')).toBe(1);
            expect(mapMap.get('k', 'b')).toBe(2);
        });
        it('returns undefined for missing entries', () => {
            mapMap.set('k', 'a', 1);
            expect(mapMap.get('k', 'missing')).toBeUndefined();
            expect(mapMap.get('missing', 'a')).toBeUndefined();
        });
        it('returns the inner Map when called with a single key', () => {
            mapMap.set('k', 'a', 1);
            const inner = mapMap.get('k');
            expect(inner).toBeInstanceOf(Map);
            expect(inner?.get('a')).toBe(1);
        });
        it('assigns an inner Map directly when called with two arguments', () => {
            const inner = new Map<string, number>([['a', 1], ['b', 2]]);
            mapMap.set('k', inner);
            expect(mapMap.get('k')).toBe(inner);
            expect(mapMap.get('k', 'b')).toBe(2);
        });
        it('overwrites the existing inner Map on direct assignment', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', new Map([['b', 2]]));
            expect(mapMap.get('k', 'a')).toBeUndefined();
            expect(mapMap.get('k', 'b')).toBe(2);
        });
        it('overwrites an existing nested value', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', 'a', 2);
            expect(mapMap.get('k', 'a')).toBe(2);
        });
        it('returns itself for chaining', () => {
            expect(mapMap.set('k', 'a', 1)).toBe(mapMap);
        });
    });

    describe('has', () => {
        it('checks the outer key', () => {
            mapMap.set('k', 'a', 1);
            expect(mapMap.has('k')).toBe(true);
            expect(mapMap.has('missing')).toBe(false);
        });
        it('checks the nested key', () => {
            mapMap.set('k', 'a', 1);
            expect(mapMap.has('k', 'a')).toBe(true);
            expect(mapMap.has('k', 'missing')).toBe(false);
            expect(mapMap.has('missing', 'a')).toBe(false);
        });
    });

    describe('delete', () => {
        it('removes a nested value and reports whether it existed', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', 'b', 2);
            expect(mapMap.delete('k', 'a')).toBe(true);
            expect(mapMap.has('k', 'a')).toBe(false);
            expect(mapMap.has('k', 'b')).toBe(true);
        });
        it('removes the outer entry once the inner map becomes empty', () => {
            mapMap.set('k', 'a', 1); mapMap.delete('k', 'a');
            expect(mapMap.has('k')).toBe(false);
            expect(mapMap.size).toBe(0);
        });
        it('removes the whole entry when called with one argument', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', 'b', 2);
            expect(mapMap.delete('k')).toBe(true);
            expect(mapMap.has('k')).toBe(false);
            expect(mapMap.delete('k')).toBe(false);
        });
        it('returns false when nothing was removed', () => {
            expect(mapMap.delete('k', 'a')).toBe(false);
            expect(mapMap.delete('missing')).toBe(false);
        });
    });

    describe('keys iteration', () => {
        it('iterates the outer keys', () => {
            mapMap.set('a', 'x', 1); mapMap.set('b', 'y', 2);
            expect([...mapMap.keys()].sort()).toEqual(['a', 'b']);
        });
        it('iterates the inner keys held by a given key', () => {
            mapMap.set('k', 'a', 1); mapMap.set('k', 'b', 2);
            expect([...mapMap.keys('k')].sort()).toEqual(['a', 'b']);
        });
        it('yields an empty iterator for a missing key', () => {
            expect([...mapMap.keys('missing')]).toEqual([]);
        });
    });
});
