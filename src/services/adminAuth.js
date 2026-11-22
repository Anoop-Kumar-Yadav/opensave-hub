/**
 * OpenSave Admin Authentication via Supabase Auth.
 * Uses server-signed JWT `app_metadata.role === "admin"` (tamper-proof).
 * Lazy-loads @supabase/supabase-js from esm.sh only when online so offline mode never breaks.
 */

const SUPABASE_URL = "https://vewnfsarxqdmkkdrusqo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pMjJJ_T96QX-EEqI9ehbUA_9VsfprUL";

let clientPromise = null;

async function getSupabaseClient() {
  if (clientPromise) return clientPromise;
  if (!navigator.onLine) {
    throw new Error("Offline — connect to the internet for Admin sign-in.");
  }
  clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY))
    .catch((err) => {
      clientPromise = null;
      throw new Error("Failed to load Supabase Auth SDK: " + (err?.message || err));
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

export async function getAdminSession() {
  if (!navigator.onLine) return parseSession(null);
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return parseSession(data?.session || null);
  } catch {
    return parseSession(null);
  }
}

export async function signInAdminWithGoogle() {
  const supabase = await getSupabaseClient();
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOutAdmin() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function onAdminAuthChange(callback) {
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
