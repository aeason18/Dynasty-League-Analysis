import { createReadClient } from "@/lib/supabase/server";
import type { League } from "@/lib/types";

export async function getLeagues(): Promise<League[]> {
  const db = createReadClient();
  const { data, error } = await db.from("leagues").select("*").order("season", { ascending: true });
  if (error) throw error;
  return (data ?? []) as League[];
}

export async function getCurrentLeague(): Promise<League | null> {
  const db = createReadClient();
  const { data, error } = await db.from("leagues").select("*").eq("is_current", true).maybeSingle();
  if (error) throw error;
  return data as League | null;
}

export async function getLeagueBySeason(season: string): Promise<League | null> {
  const db = createReadClient();
  const { data, error } = await db.from("leagues").select("*").eq("season", season).maybeSingle();
  if (error) throw error;
  return data as League | null;
}
