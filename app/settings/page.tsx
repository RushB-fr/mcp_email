import { redirect } from "next/navigation";

/**
 * /settings has no content of its own anymore - it's split into
 * /settings/{mailboxes,organizations,apps} (see app/settings/layout.tsx for
 * the shared sidebar). Mailboxes is the default landing section, matching
 * design-proposal-v2.html's sidebar (its "Boîtes mail" entry is the one
 * shown active).
 */
export default function SettingsPage() {
  redirect("/settings/mailboxes");
}
