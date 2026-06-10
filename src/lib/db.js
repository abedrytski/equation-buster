// Database access for profiles + level progress.
// Uses the single Supabase client created in auth.js (loaded via CDN), so the
// signed-in user's session/RLS applies to every query.

import { getSupabase } from "./auth.js";

// --- User Profile ---

// Fetch the signed-in user's profile, creating a blank row on first login.
export async function getOrCreateUser(userId) {
  const sb = await getSupabase();

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code === "PGRST116") {
    // No row yet — create one.
    const { data: created, error: insertError } = await sb
      .from("profiles")
      .insert([{ id: userId, display_name: "Player", total_points: 0, current_world: 1 }])
      .select()
      .single();
    if (insertError) console.error("Failed to create profile:", insertError);
    return created;
  }
  if (error) console.error("Failed to load profile:", error);
  return data;
}

export async function updateUserProfile(userId, updates) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) console.error("Failed to update profile:", error);
  return data;
}

// --- Level Progress ---

export async function saveLevelProgress(userId, world, level, stars, score) {
  const sb = await getSupabase();
  const normalizedStars = Math.min(3, Math.max(0, stars));

  // Read the existing row so we only ever raise stars/score (best result wins).
  const { data: existing } = await sb
    .from("level_progress")
    .select("stars, score")
    .eq("user_id", userId)
    .eq("world", world)
    .eq("level", level)
    .single();

  const bestStars = Math.max(normalizedStars, existing?.stars ?? 0);
  const bestScore = Math.max(score, existing?.score ?? 0);

  const { data, error } = await sb
    .from("level_progress")
    .upsert(
      {
        user_id: userId,
        world,
        level,
        stars: bestStars,
        score: bestScore,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,world,level" }
    )
    .select()
    .single();

  if (error) console.error("Failed to save level progress:", error);
  return data;
}

// All progress rows for a single world.
export async function getWorldProgress(userId, world) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("level_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("world", world)
    .order("level");
  if (error) console.error("Failed to load world progress:", error);
  return data || [];
}

// Every progress row for the user (across all worlds) — used for totals.
export async function getAllProgress(userId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from("level_progress")
    .select("*")
    .eq("user_id", userId);
  if (error) console.error("Failed to load all progress:", error);
  return data || [];
}
