import { normalizeKuwaitiPhone } from '@/lib/phone-utils';

export type InviteeInput = {
  name?: string | null;
  phone: string;
};

export type NormalizedInvitee = {
  name: string | null;
  phone: string;
};

export type ValidationResult =
  | { valid: true; invitees: NormalizedInvitee[] }
  | { valid: false; error: string };

export function validateAndNormalizeInvitees(
  rawInvitees: unknown,
  maxLimit: number = 5
): ValidationResult {
  if (rawInvitees === undefined || rawInvitees === null) {
    return { valid: true, invitees: [] };
  }

  if (!Array.isArray(rawInvitees)) {
    return { valid: false, error: 'قائمة المدعوين غير صحيحة' };
  }

  if (rawInvitees.length === 0) {
    return { valid: true, invitees: [] };
  }

  if (rawInvitees.length > maxLimit) {
    return {
      valid: false,
      error: maxLimit === 5
        ? 'الحد الأقصى للمدعوين هو 5 مدعوين فقط'
        : `الحد الأقصى للمشاركين هو ${maxLimit} مشاركاً فقط`,
    };
  }

  const normalizedList: NormalizedInvitee[] = [];
  const seenPhones = new Set<string>();

  for (const item of rawInvitees) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'بيانات المدعو غير صحيحة' };
    }

    const rawPhone = (item as Record<string, unknown>).phone;
    if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
      return { valid: false, error: 'رقم الهاتف إلزامي لكل مدعو' };
    }

    const normalizedPhone = normalizeKuwaitiPhone(rawPhone);
    if (!normalizedPhone) {
      return {
        valid: false,
        error: 'رقم هاتف المدعو غير صالح (يجب أن يكون رقم كويتي يتكون من 8 أرقام)',
      };
    }

    if (seenPhones.has(normalizedPhone)) {
      return {
        valid: false,
        error: 'تم إدخال نفس رقم المدعو أكثر من مرة',
      };
    }

    seenPhones.add(normalizedPhone);

    const rawName = (item as Record<string, unknown>).name;
    let name: string | null = null;
    if (typeof rawName === 'string' && rawName.trim()) {
      const trimmed = rawName.trim();
      if (trimmed.length > 80) {
        return {
          valid: false,
          error: 'اسم المدعو لا يجب أن يتجاوز 80 حرفًا',
        };
      }
      name = trimmed;
    }

    normalizedList.push({
      name,
      phone: normalizedPhone,
    });
  }

  return { valid: true, invitees: normalizedList };
}

/**
 * Merges saved participants and manual invitees into a single deduplicated list
 * keyed by normalized Kuwaiti phone number (+965XXXXXXXX).
 * If a phone exists in both sources or across departments, the entries are merged into one.
 * Deterministic name resolution: prefers a non-empty name (manual name if provided, else saved name).
 */
export function mergeAndDeduplicateParticipants(
  savedList: Array<{ name: string | null; phone: string }>,
  manualList: NormalizedInvitee[]
): NormalizedInvitee[] {
  const map = new Map<string, NormalizedInvitee>();

  for (const saved of savedList) {
    const normalized = normalizeKuwaitiPhone(saved.phone);
    if (!normalized) continue;
    const existing = map.get(normalized);
    if (existing) {
      const resolvedName = existing.name || saved.name?.trim() || null;
      map.set(normalized, { name: resolvedName, phone: normalized });
    } else {
      map.set(normalized, {
        name: saved.name?.trim() || null,
        phone: normalized,
      });
    }
  }

  for (const manual of manualList) {
    const normalized = normalizeKuwaitiPhone(manual.phone) || manual.phone;
    const existing = map.get(normalized);
    if (existing) {
      const resolvedName = manual.name?.trim() || existing.name?.trim() || null;
      map.set(normalized, {
        name: resolvedName,
        phone: normalized,
      });
    } else {
      map.set(normalized, {
        name: manual.name?.trim() || null,
        phone: normalized,
      });
    }
  }

  return Array.from(map.values());
}
