//----------------------------------------------------------------------------------------------------
// item — the shape a selectable row / tab / segment takes in a component's `items` prop
// Lives here rather than in one of the components because Listbox, Panel and InputRadioGroup all
// take the same list; each of them normalizes a bare value inline (`typeof item === 'object' ? ...`)
// at the one place it builds its rows, so there is no helper to import alongside the type.
//----------------------------------------------------------------------------------------------------

// either the bare value, or a value with its own display label
export type ItemDef<T = string> = T | { value: T, label?: string };
