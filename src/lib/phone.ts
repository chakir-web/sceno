/**
 * Normalise un numéro marocain vers le format national 0XXXXXXXXX.
 * Accepte mobile 06/07, fixe 05 et 08, avec préfixes +212, 00212 ou 212.
 */
export function normalizeMoroccanPhone(input: string): string | null {
  const compact = input.replace(/[^\d+]/g, "");
  let national = compact;

  if (national.startsWith("+212")) national = `0${national.slice(4)}`;
  else if (national.startsWith("00212")) national = `0${national.slice(5)}`;
  else if (national.startsWith("212") && national.length === 12) national = `0${national.slice(3)}`;

  if (!/^0[5-8]\d{8}$/.test(national)) return null;
  return national;
}

export function formatPhone(national: string) {
  const digits = normalizeMoroccanPhone(national) ?? national.replace(/\D/g, "");
  if (digits.length !== 10) return national;
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

export function phoneHref(national: string) {
  const normalized = normalizeMoroccanPhone(national);
  if (!normalized) return `tel:${national.replace(/\s/g, "")}`;
  return `tel:+212${normalized.slice(1)}`;
}
