import { AuthFrame, BootstrapForm, LoginForm } from "@/components/auth/staff-access";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import { getSetupStatus } from "@/lib/services/setup";

export default async function LoginPage() {
  const { dict } = await getI18n();
  const status = await getSetupStatus();
  return (
    <AuthFrame title={dict.auth.title} lead={dict.auth.lead}>
      {!status.configured || !status.migrationReady ? <SetupPanel dict={dict} /> : <LoginForm />}
      {status.configured && status.migrationReady && status.serviceRole && status.tokenSet && !status.hasAdmin ? <BootstrapForm /> : null}
    </AuthFrame>
  );
}
