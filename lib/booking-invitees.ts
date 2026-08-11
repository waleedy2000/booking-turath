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

export function validateAndNormalizeInvitees(rawInvitees: unknown): ValidationResult {
  if (rawInvitees === undefined || rawInvitees === null) {
    return { valid: true, invitees: [] };
  }

  if (!Array.isArray(rawInvitees)) {
    return { valid: false, error: 'قائمة المدعوين غير صحيحة' };
  }

  if (rawInvitees.length === 0) {
    return { valid: true, invitees: [] };
  }

  if (rawInvitees.length > 5) {
    return { valid: false, error: 'الحد الأقصى للمدعوين هو 5 مدعوين فقط' };
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
