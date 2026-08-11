import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { normalizeKuwaitiPhone, maskPhone } from "@/lib/phone-utils";

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
 * Resolve all booking notification recipients for a department and optional booking:
 * booking contact + active participants + booking invitees, normalized and deduplicated.
 */
export async function getBookingNotificationRecipients(departmentId: string, bookingId?: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('booking_contact_phone, phone')
    .eq('id', departmentId)
    .single();

  if (deptError || !department) {
    console.error("[ParticipantService] Error fetching department contact:", deptError);
  }

  const unique = new Set<string>();

  // 1. Add department contact (with fallback)
  let managerAdded = false;
  const rawContactPhone = department?.booking_contact_phone;
  const normalizedContact = normalizeKuwaitiPhone(rawContactPhone);

  if (normalizedContact) {
    unique.add(normalizedContact);
    managerAdded = true;
  } else if (rawContactPhone) {
    console.warn(`[ParticipantService] Invalid booking_contact_phone (${maskPhone(rawContactPhone)}) for department ${departmentId}. Trying fallback.`);
  }

  // Fallback to department.phone
  if (!managerAdded && department?.phone) {
    const fallbackPhone = normalizeKuwaitiPhone(department.phone);
    if (fallbackPhone) {
      unique.add(fallbackPhone);
    } else {
      console.warn(`[ParticipantService] Invalid fallback phone (${maskPhone(department.phone)}) for department ${departmentId}.`);
    }
  }

  // 2. Add active participants
  const participantPhones = await getParticipantPhones(departmentId);
  for (const phone of participantPhones) {
    const normalized = normalizeKuwaitiPhone(phone);
    if (normalized) {
      unique.add(normalized);
    } else {
      console.warn(`[ParticipantService] Skipping invalid participant phone (${maskPhone(phone)}) for department ${departmentId}.`);
    }
  }

  // 3. Add booking invitees if bookingId is provided
  if (bookingId) {
    const { data: invitees, error: inviteesError } = await supabase
      .from('booking_invitees')
      .select('phone')
      .eq('booking_id', bookingId);

    if (inviteesError) {
      console.error(`[ParticipantService] Error fetching invitees for booking ${bookingId}:`, inviteesError);
      throw new Error(`Failed to fetch booking invitees: ${inviteesError.message}`);
    }

    for (const invitee of invitees || []) {
      const normalized = normalizeKuwaitiPhone(invitee.phone);
      if (normalized) {
        unique.add(normalized);
      } else {
        console.warn(`[ParticipantService] Skipping invalid invitee phone (${maskPhone(invitee.phone)}) for booking ${bookingId}.`);
      }
    }
  }

  return Array.from(unique);
}
