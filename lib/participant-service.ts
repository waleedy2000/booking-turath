import { getSupabaseAdmin } from "@/utils/supabase-admin";

export function normalizeKuwaitiPhone(phone?: string | null): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('965') && digits.length === 11) {
    return `+${digits}`;
  }

  if (digits.length === 8) {
    return `+965${digits}`;
  }

  return `+${digits}`;
}

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

/**
 * Resolve all booking notification recipients for a department:
 * booking contact + active participants, normalized and deduplicated.
 */
export async function getBookingNotificationRecipients(departmentId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('booking_contact_phone, phone')
    .eq('id', departmentId)
    .single();

  if (deptError || !department) {
    console.error("[ParticipantService] Error fetching department contact:", deptError);
  }

  const participantPhones = await getParticipantPhones(departmentId);
  const phones = [
    department?.booking_contact_phone,
    department?.phone,
    ...participantPhones,
  ];

  const unique = new Set<string>();
  for (const phone of phones) {
    const normalized = normalizeKuwaitiPhone(phone);
    if (normalized) unique.add(normalized);
  }

  return Array.from(unique);
}
