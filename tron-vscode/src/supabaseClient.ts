import { createClient } from '@supabase/supabase-js';
import * as vscode from 'vscode';

export function createSupabaseClient(context: vscode.ExtensionContext, supabaseUrl: string, supabaseAnonKey: string) {
    // 🌟 FIX: Bypass the strict TypeScript check for the secrets API
    const extContext = context as any;

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: {
                getItem: async (key: string) => {
                    const secret = await extContext.secrets.get(key);
                    return secret || null;
                },
                setItem: async (key: string, value: string) => {
                    await extContext.secrets.store(key, value);
                },
                removeItem: async (key: string) => {
                    await extContext.secrets.delete(key);
                }
            },
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
        }
    });
}