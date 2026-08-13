import {
  useGetExternalMembersQuery,
  useInviteExternalMemberMutation,
} from "@/redux/apis/organization/externalMember.api"
import type { InviteExternalMemberPayload } from "@/redux/apis/organization/externalMember.api"
import type { ExternalOrgMember } from "@/types/organizationMember"
import { Check, Copy, Loader2, Plus, UserPlus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"

// aexa-frontend#216. No "role" field on the invite form -- the backend
// hard-rejects anything but LIGHT_USER today (see
// InviteExternalMemberPayload's own comment), so offering a choice here
// would just be an option that always 400s.
//
// aexa-frontend#239 -- gated the invite affordance the same way #217 gates
// base entity CRUD: a VIEWER/LIGHT_USER previously saw a fully interactive
// external-invite form with no client-side check. copyLink is left ungated
// deliberately -- it only reads an already-visible field to the clipboard
// and performs no server mutation, so there's nothing to protect.
export default function ExternalMembersSection() {
  const { t } = useTranslation()
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const {
    data: membersData,
    isLoading: membersLoading,
    error: membersError,
  } = useGetExternalMembersQuery()
  const [inviteExternalMember, { isLoading: isInviting }] =
    useInviteExternalMemberMutation()

  const members: ExternalOrgMember[] = membersData?.data ?? []

  const inviteForm = useForm<InviteExternalMemberPayload>({
    defaultValues: { email: "", fullName: "" },
  })

  const openInvite = () => {
    inviteForm.reset({ email: "", fullName: "" })
    setShowInviteForm(true)
  }

  const handleInvite = async (values: InviteExternalMemberPayload) => {
    try {
      await inviteExternalMember({
        email: values.email,
        fullName: values.fullName || undefined,
      }).unwrap()
      toast.success(
        t("organization.externalMembers.invitationAdded", {
          email: values.email,
        })
      )
      setShowInviteForm(false)
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.externalMembers.inviteFailed")
      toast.error(message)
    }
  }

  // The login link's organizationId is the org this member row belongs to,
  // not derivable from anything the admin already has open in this tab --
  // ExternalOrgMember.organizationId IS Organization.id (see the type's own
  // comment), which is exactly what /external-login/:organizationId needs.
  const loginLinkFor = (member: ExternalOrgMember) =>
    `${window.location.origin}/external-login/${member.organizationId}`

  const handleCopyLink = async (member: ExternalOrgMember) => {
    try {
      await navigator.clipboard.writeText(loginLinkFor(member))
      setCopiedId(member.id)
      toast.success(t("organization.externalMembers.linkCopied"))
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t("organization.externalMembers.copyFailed"))
    }
  }

  if (membersLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (membersError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-destructive">
        {t("organization.externalMembers.loadFailed")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t("organization.externalMembers.heading")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("organization.externalMembers.subheading")}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openInvite}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            {t("organization.externalMembers.inviteButton")}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground uppercase">
              <th className="px-5 py-3 font-medium">
                {t("organization.externalMembers.colName")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.externalMembers.colEmail")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.externalMembers.colStatus")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.externalMembers.colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium text-foreground">
                  {member.fullName || "—"}
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {member.email}
                </td>
                <td className="px-5 py-3">
                  {member.isExpired ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {t("organization.externalMembers.statusExpired")}
                    </span>
                  ) : member.isActive ? (
                    <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                      {t("organization.externalMembers.statusActive")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                      {t("organization.externalMembers.statusInactive")}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(member)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {copiedId === member.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedId === member.id
                      ? t("organization.externalMembers.copied")
                      : t("organization.externalMembers.copyLink")}
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-muted-foreground"
                >
                  {t("organization.externalMembers.noMembers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <Dialog
          open={showInviteForm}
          onOpenChange={(open) => {
            if (!open && isInviting) return
            setShowInviteForm(open)
          }}
        >
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {t("organization.externalMembers.inviteTitle")}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={inviteForm.handleSubmit(handleInvite)}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="external-invite-email"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.externalMembers.emailLabel")}
                  </label>
                  <input
                    id="external-invite-email"
                    type="email"
                    {...inviteForm.register("email", {
                      required: t("organization.externalMembers.emailRequired"),
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: t("organization.externalMembers.emailInvalid"),
                      },
                    })}
                    placeholder={t(
                      "organization.externalMembers.emailPlaceholder"
                    )}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                  {inviteForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {inviteForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="external-invite-name"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.externalMembers.nameLabel")}
                  </label>
                  <input
                    id="external-invite-name"
                    type="text"
                    {...inviteForm.register("fullName")}
                    placeholder={t(
                      "organization.externalMembers.namePlaceholder"
                    )}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="mt-8 flex flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  disabled={isInviting}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {t("organization.externalMembers.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isInviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t("organization.externalMembers.sendInvite")}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
