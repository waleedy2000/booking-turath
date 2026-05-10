export function normalizeKuwaitiPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new Error("Phone number is required");
  }

  let localPart = trimmed;

  if (trimmed.startsWith("+")) {
    if (!trimmed.startsWith("+965")) {
      throw new Error("Phone number must be a Kuwaiti number");
    }
    localPart = trimmed.slice(4);
  } else if (trimmed.startsWith("965")) {
    localPart = trimmed.slice(3);
  }

  if (!/^\d{8}$/.test(localPart)) {
    throw new Error("Phone number must be 8 digits after +965");
  }

  return `+965${localPart}`;
}

export function normalizeOptionalKuwaitiPhone(phone?: string | null): string | null {
  if (phone === undefined || phone === null || phone.trim() === "") {
    return null;
  }

  return normalizeKuwaitiPhone(phone);
}
