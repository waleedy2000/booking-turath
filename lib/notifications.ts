export async function sendToEntity(entity_id: string, title: string, body: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  await fetch(`${baseUrl}/api/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity_id, title, body }),
  }).catch(err => console.error("[sendToEntity] fetch error:", err));
}