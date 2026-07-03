//----------------------------------------------------------------------------------------------------
// map utilities — two-level Map subclasses (used for Unit listener tables and reverse indexes)
//
// The inner collection is created on insert and the outer entry is removed once it becomes empty.
// Each method operates on the outer or inner level depending on the number of arguments.
//
// - MapSet<Key, Value>        : Map<Key, Set<Value>>
// - MapMap<Key1, Key2, Value> : Map<Key1, Map<Key2, Value>>
//----------------------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------------------
// map set
//----------------------------------------------------------------------------------------------------

export class MapSet<Key, Value> extends Map<Key, Set<Value>> {

    public has(key: Key): boolean;
    public has(key: Key, value: Value): boolean;
    public has(key: Key, value?: Value): boolean {
        if (value === undefined) {
            return super.has(key);
        } else {
            return super.get(key)?.has(value) ?? false;
        }
    }

    public add(key: Key, value: Value): MapSet<Key, Value> {
        let set = super.get(key);
        if (set === undefined) {
            set = new Set<Value>();
            super.set(key, set);
        }
        set.add(value);
        return this;
    }

    public keys(): IterableIterator<Key>;
    public keys(key: Key): IterableIterator<Value>;
    public keys(key?: Key): IterableIterator<Key> | IterableIterator<Value> {
        if (key === undefined) {
            return super.keys();
        } else {
            return super.get(key)?.values() ?? [].values();
        }
    }

    public delete(key: Key): boolean;
    public delete(key: Key, value: Value): boolean;
    public delete(key: Key, value?: Value): boolean {
        if (value === undefined) {
            return super.delete(key);
        } else {
            const set = super.get(key);
            if (set === undefined) {
                return false;
            } else {
                const ret = set.delete(value);
                if (set.size === 0) {
                    super.delete(key);
                }
                return ret;
            }
        }
    }
}

//----------------------------------------------------------------------------------------------------
// map map
//----------------------------------------------------------------------------------------------------

export class MapMap<Key1, Key2, Value> extends Map<Key1, Map<Key2, Value>> {

    public has(key1: Key1): boolean;
    public has(key1: Key1, key2: Key2): boolean;
    public has(key1: Key1, key2?: Key2): boolean {
        if (key2 === undefined) {
            return super.has(key1);
        } else {
            return super.get(key1)?.has(key2) ?? false;
        }
    }

    public set(key1: Key1, value: Map<Key2, Value>): this;
    public set(key1: Key1, key2: Key2, value: Value): this;
    public set(key1: Key1, key2OrValue: Key2 | Map<Key2, Value>, value?: Value): this {
        if (value === undefined) {
            super.set(key1, key2OrValue as Map<Key2, Value>);
        } else {
            let inner = super.get(key1);
            if (inner === undefined) {
                inner = new Map<Key2, Value>();
                super.set(key1, inner);
            }
            inner.set(key2OrValue as Key2, value);
        }
        return this;
    }

    public get(key1: Key1): Map<Key2, Value> | undefined;
    public get(key1: Key1, key2: Key2): Value | undefined;
    public get(key1: Key1, key2?: Key2): Map<Key2, Value> | Value | undefined {
        if (key2 === undefined) {
            return super.get(key1);
        } else {
            return super.get(key1)?.get(key2);
        }
    }

    public keys(): IterableIterator<Key1>;
    public keys(key1: Key1): IterableIterator<Key2>;
    public keys(key1?: Key1): IterableIterator<Key1> | IterableIterator<Key2> {
        if (key1 === undefined) {
            return super.keys();
        } else {
            return super.get(key1)?.keys() ?? [].values();
        }
    }

    public delete(key1: Key1): boolean;
    public delete(key1: Key1, key2: Key2): boolean;
    public delete(key1: Key1, key2?: Key2): boolean {
        if (key2 === undefined) {
            return super.delete(key1);
        } else {
            const inner = super.get(key1);
            if (inner === undefined) {
                return false;
            } else {
                const ret = inner.delete(key2);
                if (inner.size === 0) {
                    super.delete(key1);
                }
                return ret;
            }
        }
    }
}
