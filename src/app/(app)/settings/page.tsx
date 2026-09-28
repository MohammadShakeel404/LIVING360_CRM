import { getServerSession } from "next-auth";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCompanySettings } from "@/lib/settings";
import { parseSchedule, toDrafts } from "@/lib/contracts";
import { EmptyState } from "@/components/ui";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  if (!can(role, "settings", "view")) {
    return <EmptyState icon={Lock} title="No access" note="Company settings are managed by admins." />;
  }
  const { updatedAt, id, ...settings } = await getCompanySettings();
  return <SettingsClient initial={{ ...settings, paymentSchedule: toDrafts(parseSchedule(settings.paymentSchedule)) }} canEdit={can(role, "settings", "edit")} />;
}
