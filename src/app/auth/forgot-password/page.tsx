import { AuthFrame, ForgotForm } from "@/components/auth/staff-access";
import { getI18n } from "@/lib/i18n/server";

export default async function ForgotPage() {
  const { dict } = await getI18n();
  return <AuthFrame title={dict.auth.forgotTitle} lead={dict.auth.forgotLead}><ForgotForm /></AuthFrame>;
}
