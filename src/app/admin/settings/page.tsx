import { SettingsForm } from "@/components/admin/settings-form";
import { PageIntro } from "@/components/ui/primitives";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import { getSettings, listRates } from "@/lib/services/settings";

export default async function SettingsPage() {
  const { dict } = await getI18n();
  const [settings, rates] = await Promise.all([getSettings(), listRates(true)]);
  if (!settings.data) return <SetupPanel dict={dict} />;
  return (
    <div>
      <PageIntro title={dict.admin.settings.title} />
      <SettingsForm settings={settings.data} rates={rates.data} />
    </div>
  );
}
