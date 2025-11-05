import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

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
        upsert: () => fromMock, // FIX: Add missing 'upsert' method
        in: () => fromMock,     // FIX: Add missing 'in' method
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
            onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
                // To prevent an infinite loading state, we must invoke the callback.
                // We simulate the initial check by calling it asynchronously with a null session.
                setTimeout(() => {
                    callback('INITIAL_SESSION', null);
                }, 0);
                return {
                    data: { subscription: { unsubscribe: () => {} } },
                };
            },
        },
        // Add other top-level properties to satisfy the SupabaseClient type.
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


// Prioritize environment variables, fall back to localStorage, then to hardcoded defaults.
const supabaseUrl = process.env.SUPABASE_URL || localStorage.getItem('supabaseUrl') || 'https://mjrshqlpomrezudlpmoj.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || localStorage.getItem('supabaseAnonKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcnNocWxwb21yZXp1ZGxwbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzY1MDcsImV4cCI6MjA3NzM1MjUwN30.CY46g7Qnua63CrsWteAAFvMHeU75hwfZzeLfjOKCKNI';


let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error("Failed to initialize Supabase client. Check credentials.", error);
        // Fallback to mock client if initialization fails for some reason (e.g., malformed URL)
        supabase = createMockClient();
    }
} else {
    // This block is now less likely to be hit, but kept for robustness.
    console.warn(`Supabase URL or Anon Key is missing. 
    Please use the Developer Panel (type 'devmode') to configure them.`);
    supabase = createMockClient();
}


export { supabase };