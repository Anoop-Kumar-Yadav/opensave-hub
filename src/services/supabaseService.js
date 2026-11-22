/**
 * OpenSave Unified Supabase Service:
 * - Single Google OAuth Sign-In / Sign-Out
 * - Server-signed JWT `app_metadata.role === "admin"` check
 * - Cloud Backup & Restore via `user_backups` Postgres table (protected by RLS)
 * Lazy-loads @supabase/supabase-js from esm.sh only when online so offline mode never breaks.
 */

const SUPABASE_URL = "https://vewnfsarxqdmkkdrusqo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pMjJJ_T96QX-EEqI9ehbUA_9VsfprUL";
const BACKUP_TABLE = "user_backups";

let clientPromise = null;

async function getSupabaseClient() {
  if (clientPromise) return clientPromise;
  if (!navigator.onLine) {
    throw new Error("You are offline. Connect to the internet to sign in or sync.");
  }
  clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY))
    .catch((err) => {
      clientPromise = null;
      throw new Error("Failed to load Supabase SDK: " + (err?.message || err));
    });
  return clientPromise;
}

function parseSession(session) {
  const user = session?.user || null;
  const role = user?.app_metadata?.role || "user";
  return {
    user,
    email: user?.email || "",
    name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "",
    role,
    isAdmin: role === "admin",
  };
}

export async function getAuthSession() {
  if (!navigator.onLine) return parseSession(null);
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return parseSession(data?.session || null);
  } catch {
    return parseSession(null);
  }
}

export async function signInWithGoogle() {
  const supabase = await getSupabaseClient();
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function onAuthChange(callback) {
  if (!navigator.onLine) return;
  try {
    const supabase = await getSupabaseClient();
    supabase.auth.onAuthStateChange((_event, session) => {
      callback(parseSession(session));
    });
  } catch {
    // Offline or blocked
  }
}

export async function backupToSupabase(payload) {
  const supabase = await getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) throw new Error("Please sign in first to back up your data.");

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(BACKUP_TABLE)
    .upsert(
      { user_id: user.id, payload, updated_at: updatedAt },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message || "Cloud backup failed.");
  }
  return { updatedAt };
}

export async function restoreFromSupabase() {
  const supabase = await getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) throw new Error("Please sign in first to restore your data.");

  const { data, error } = await supabase
    .from(BACKUP_TABLE)
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Cloud restore failed.");
  }
  if (!data || !data.payload) {
    throw new Error("No cloud backup found for your account yet.");
  }
  return { data: data.payload, updatedAt: data.updated_at };
}
