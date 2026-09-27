import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const authEnabled = Boolean(url && anonKey);
export const supabaseAuth = authEnabled ? createClient(url, anonKey) : null;

export async function signIn(email, password) {
  if (!supabaseAuth) throw new Error('Supabase Auth is not configured.');
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}
export async function signOut() { if (supabaseAuth) await supabaseAuth.auth.signOut(); }
export async function getSession() { if (!supabaseAuth) return null; const { data } = await supabaseAuth.auth.getSession(); return data.session; }
