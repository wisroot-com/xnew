//----------------------------------------------------------------------------------------------------
// ElementAttributes — a caller-supplied attribute bag for an internal part of a basics component
// The core's DomElementDef minus `tag`: className / style plus any other element attribute.
// Generated class names are page-unique, so components expose named parts that each take one of these.
//----------------------------------------------------------------------------------------------------

export interface ElementAttributes { className?: string; style?: string; [key: string]: any; }
