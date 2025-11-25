// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a mock Supabase client that prevents the app from crashing
 * and provides helpful error messages when Supabase is not configured.
 */
function createMockClient(): SupabaseClient {
    const unconfiguredError = { 
        message: 'Supabase is not configured. Please set URL and Anon Key in the Developer Panel.', 
        name: 'UnconfiguredClient', 
        status: 500,
        code: 'UNCONFIGURED_CLIENT',
    };

    // A promise-like object that always resolves with an error.
    const thenable = {
        then: (resolve: (value: { data: null, error: typeof unconfiguredError }) => void) => {
            resolve({ data: null, error: unconfiguredError });
        },
        catch: (reject: (reason: any) => void) => {},
    };

    // A mock for the query builder chain (.from(...).select(...).etc)
    const fromMock = {
        select: () => fromMock,
        insert: () => fromMock,
        update: () => fromMock,
        delete: () => fromMock,
        eq: () => fromMock,
        order: () => fromMock,
        single: () => thenable,
        upsert: () => fromMock, 
        in: () => fromMock,     
        ...thenable,
    };
    
    const mockClient = {
        from: (table: string) => fromMock,
        auth: {
            signUp: () => Promise.resolve({ data: { user: null, session: null }, error: unconfiguredError }),
            signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: unconfiguredError }),
            signOut: () => Promise.resolve({ error: null }),
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: (_callback: any) => ({
                data: { subscription: { unsubscribe: () => {} } },
            }),
        },
        storage: {},
        rpc: {},
        channel: () => ({
            subscribe: () => ({
                on: () => {},
                receive: () => {},
            })
        }),
        removeChannel: () => {},
        removeChannels: () => {},
        getChannels: () => [],
    };

    return mockClient as unknown as SupabaseClient;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';


let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error("Failed to initialize Supabase client. Check credentials.", error);
        supabase = createMockClient();
    }
} else {
    console.warn(`Supabase URL or Anon Key is missing. 
    Please use the Developer Panel (type 'devmode') to configure them.`);
    supabase = createMockClient();
}


export { supabase };