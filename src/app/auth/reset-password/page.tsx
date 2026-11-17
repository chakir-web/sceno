import { AuthFrame, ResetForm } from "@/components/auth/staff-access";
import { getI18n } from "@/lib/i18n/server";

export default async function ResetPage() {
  const { dict } = await getI18n();
  return <AuthFrame title={dict.auth.resetTitle} lead={dict.auth.resetLead}><ResetForm /></AuthFrame>;
}
