import { getSupabaseAdmin } from "@/utils/supabase-admin";

/**
 * Get active participant phone numbers for a department.
 */
export async function getParticipantPhones(departmentId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('department_participants')
    .select('phone')
    .eq('department_id', departmentId)
    .eq('is_active', true);

  if (error) {
    console.error("[ParticipantService] Error fetching participants:", error);
    return [];
  }

  return (data || []).map((p: { phone: string }) => p.phone);
}

/**
 * Get booking contact phone for a department (fallback to legacy phone field).
 */
export async function getDepartmentContact(departmentId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('departments')
    .select('booking_contact_phone, phone')
    .eq('id', departmentId)
    .single();

  if (error || !data) return null;

  return data.booking_contact_phone || data.phone || null;
}
