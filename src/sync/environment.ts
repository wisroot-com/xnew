//----------------------------------------------------------------------------------------------------
// environment — server/client runtime detection for xsync (auto-detected; setEnvironment overrides for tests)
//----------------------------------------------------------------------------------------------------

let environment: 'server' | 'client' | null = null;

export function setEnvironment(env: 'server' | 'client' | null): void {
    environment = env;
}

export function getEnvironment(): 'server' | 'client' {
    return environment ?? ((typeof window === 'undefined' || typeof window.document === 'undefined') ? 'server' : 'client');
}
