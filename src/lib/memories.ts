import { supabase } from "./supabase";

export type Memory = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  route: string;
  created_at: string;
  is_published: boolean;
};

const fallbackMemory: Memory = {
  id: "graduation-2026",
  slug: "graduation-2026",
  title: "A day worth remembering",
  excerpt:
    "A graduation story for Anna Joseph — a little celebration, a letter, a flight, and a keepsake made with love.",
  cover_image_url: null,
  route: "/memories/graduation-2026/",
  created_at: "2026-01-01T00:00:00.000Z",
  is_published: true,
};

export async function listMemories(): Promise<Memory[]> {
  if (!supabase) return [fallbackMemory];

  const { data, error } = await supabase
    .from("memories")
    .select("id, slug, title, excerpt, cover_image_url, route, created_at, is_published")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
