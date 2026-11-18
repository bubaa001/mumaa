export function formatMemoryDate(date: string | null, month: "short" | "long" = "short") {
  if (!date) return "Undated";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month, year: "numeric" });
}
