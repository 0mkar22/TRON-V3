import { createClient } from '@supabase/supabase-js';
import * as vscode from 'vscode';

export function createSupabaseClient(context: vscode.ExtensionContext, supabaseUrl: string, supabaseAnonKey: string) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            storage: {
                getItem: async (key: string) => {
                    const secret = await context.secrets.get(key);
                    return secret || null;
                },
                setItem: async (key: string, value: string) => {
                    await context.secrets.store(key, value);
                },
                removeItem: async (key: string) => {
                    await context.secrets.delete(key);
                }
            },
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
        }
    });
}