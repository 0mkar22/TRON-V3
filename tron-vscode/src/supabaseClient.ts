import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as vscode from 'vscode';

function createSecretStorageAdapter(secrets: vscode.SecretStorage) {
    return {
        getItem: async (key: string): Promise<string | null> => {
            return await secrets.get(key) ?? null;
        },
        setItem: async (key: string, value: string): Promise<void> => {
            await secrets.store(key, value);
        },
        removeItem: async (key: string): Promise<void> => {
            await secrets.delete(key);
        },
    };
}

export function createSupabaseClient(context: vscode.ExtensionContext, supabaseUrl: string, supabaseAnonKey: string): SupabaseClient {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: createSecretStorageAdapter(context.secrets),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
}
