import {
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  ShieldOff,
  UserPlus,
} from "lucide-react"
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
import {
  useGetAllOrgUsersQuery,
  useGetPendingInvitationsQuery,
  useInviteMemberMutation,
  useResendInvitationMutation,
  useUpdateOrgMemberMutation,
} from "@/redux/apis/organization/org.user.api"
import type { InviteMemberPayload } from "@/redux/apis/organization/org.user.api"
import type { OrgMember, PendingInvitation } from "@/types/organizationMember"
import { formatLocaleDate } from "@/utils/formatDate"
import ExternalMembersSection from "./ExternalMembersSection"

type InviteFormValues = InviteMemberPayload

// Maps a backend role enum to its i18n key. Falls back to the raw value for
// any unmapped role so an unexpected enum still renders something readable.
const ROLE_LABEL_KEYS: Record<string, string> = {
  ADMIN: "organization.teamMembers.roleAdmin",
  LEAD_AUDITOR: "organization.teamMembers.roleLeadAuditor",
  LIGHT_USER: "organization.teamMembers.roleLightUser",
  VIEWER: "organization.teamMembers.roleViewer",
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation()
  const key = ROLE_LABEL_KEYS[role]
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {key ? t(key) : role}
    </span>
  )
}

function StatusBadge({
  status,
  isExpired,
}: {
  status: string
  isExpired?: boolean
}) {
  const { t } = useTranslation()
  if (isExpired) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {t("organization.teamMembers.statusExpired")}
      </span>
    )
  }
  if (status === "SUSPENDED") {
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        {t("organization.teamMembers.statusSuspended")}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
      {t("organization.teamMembers.statusActive")}
    </span>
  )
}

export default function TeamMembersTab() {
  const { t, i18n } = useTranslation()
  // aexa-frontend#239 -- same gate as base entity CRUD (#217): member
  // management (invite/suspend/reactivate/resend) had no client-side role
  // check at all, so a VIEWER/LIGHT_USER saw fully interactive admin
  // controls -- including an ADMIN role option in the invite form and a
  // Suspend button on the org's own ADMIN row -- that only failed via a
  // 403 toast on click. Gating is a UX convenience only; every mutation is
  // re-checked server-side.
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const [showInviteForm, setShowInviteForm] = useState(false)
  // Keyed by member/invitation id, not a single flag — suspending one member
  // shouldn't disable the reactivate button on a different row.
  const [mutatingMemberId, setMutatingMemberId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const {
    data: membersData,
    isLoading: membersLoading,
    error: membersError,
  } = useGetAllOrgUsersQuery(undefined)
  const { data: invitationsData, isLoading: invitationsLoading } =
    useGetPendingInvitationsQuery(undefined)
  const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation()
  const [updateOrgMember] = useUpdateOrgMemberMutation()
  const [resendInvitation] = useResendInvitationMutation()

  const members: OrgMember[] = membersData?.data ?? []
  const invitations: PendingInvitation[] = invitationsData?.data ?? []

  const inviteForm = useForm<InviteFormValues>({
    defaultValues: { email: "", role: "LEAD_AUDITOR" },
  })

  const openInvite = () => {
    inviteForm.reset({ email: "", role: "LEAD_AUDITOR" })
    setShowInviteForm(true)
  }

  const handleInvite = async (values: InviteFormValues) => {
    try {
      const res = await inviteMember(values).unwrap()
      if (res?.success !== false) {
        toast.success(
          t("organization.teamMembers.invitationSent", { email: values.email })
        )
        setShowInviteForm(false)
      }
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.teamMembers.inviteFailed")
      toast.error(message)
    }
  }

  const handleToggleStatus = async (member: OrgMember) => {
    const nextStatus = member.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"
    setMutatingMemberId(member.id)
    try {
      await updateOrgMember({
        id: member.id,
        body: { status: nextStatus },
      }).unwrap()
      toast.success(
        nextStatus === "SUSPENDED"
          ? t("organization.teamMembers.memberSuspended")
          : t("organization.teamMembers.memberReactivated")
      )
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.teamMembers.updateStatusFailed")
      toast.error(message)
    } finally {
      setMutatingMemberId(null)
    }
  }

  const handleResend = async (invitation: PendingInvitation) => {
    setResendingId(invitation.id)
    try {
      await resendInvitation(invitation.id).unwrap()
      toast.success(
        t("organization.teamMembers.invitationResent", {
          email: invitation.email,
        })
      )
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        t("organization.teamMembers.resendFailed")
      toast.error(message)
    } finally {
      setResendingId(null)
    }
  }

  if (membersLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (membersError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-destructive">
        {t("organization.teamMembers.loadFailed")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("organization.teamMembers.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("organization.teamMembers.memberCount", {
              count: members.length,
            })}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openInvite}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            {t("organization.teamMembers.inviteMember")}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground uppercase">
              <th className="px-5 py-3 font-medium">
                {t("organization.teamMembers.colName")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.teamMembers.colEmail")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.teamMembers.colRole")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.teamMembers.colStatus")}
              </th>
              <th className="px-5 py-3 font-medium">
                {t("organization.teamMembers.colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              // Flipping status back to ACTIVE on an expired member wouldn't
              // actually restore access — isMembershipActive (server-side)
              // still denies them on expiresAt, which this UI has no control
              // for yet. Rather than ship a "Reactivate" button that looks
              // like it works but silently doesn't, disable it for this case
              // with an explanation instead of hiding the gap.
              const reactivateBlockedByExpiry =
                member.status === "SUSPENDED" && member.isExpired
              const isMutating = mutatingMemberId === member.id
              return (
                <tr
                  key={member.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-foreground">
                    {member.account?.profile?.fullName || "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {member.account?.email}
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      status={member.status}
                      isExpired={member.isExpired}
                    />
                  </td>
                  <td className="px-5 py-3">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(member)}
                        disabled={isMutating || reactivateBlockedByExpiry}
                        title={
                          reactivateBlockedByExpiry
                            ? t("organization.teamMembers.reactivateBlocked")
                            : undefined
                        }
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isMutating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : member.status === "SUSPENDED" ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5" />
                        )}
                        {member.status === "SUSPENDED"
                          ? t("organization.teamMembers.reactivate")
                          : t("organization.teamMembers.suspend")}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-muted-foreground"
                >
                  {t("organization.teamMembers.noMembers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!invitationsLoading && invitations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("organization.teamMembers.pendingInvitations")}
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">
                  {t("organization.teamMembers.colEmail")}
                </th>
                <th className="px-5 py-3 font-medium">
                  {t("organization.teamMembers.colRole")}
                </th>
                <th className="px-5 py-3 font-medium">
                  {t("organization.teamMembers.colExpires")}
                </th>
                <th className="px-5 py-3 font-medium">
                  {t("organization.teamMembers.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invite) => {
                // Same isExpired concept as member SUSPENDED rows above
                // (server-computed there via `member.isExpired`); invitations
                // don't carry a precomputed flag, so derive it here from the
                // same expiresAt the "Expires" column already renders.
                const isInviteExpired = new Date(invite.expiresAt) < new Date()
                return (
                  <tr
                    key={invite.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="flex items-center gap-2 px-5 py-3 text-foreground">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {invite.email}
                    </td>
                    <td className="px-5 py-3">
                      <RoleBadge role={invite.role} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>
                          {t("organization.teamMembers.expiresOn", {
                            date: formatLocaleDate(
                              invite.expiresAt,
                              i18n.language,
                            ),
                          })}
                        </span>
                        {isInviteExpired && (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {t("organization.teamMembers.statusExpired")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleResend(invite)}
                          disabled={resendingId === invite.id}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            isInviteExpired
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {resendingId === invite.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {isInviteExpired
                            ? t("organization.teamMembers.resendExpired")
                            : t("organization.teamMembers.resend")}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border pt-6">
        <ExternalMembersSection />
      </div>

      {canWrite && (
        <Dialog open={showInviteForm} onOpenChange={setShowInviteForm}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {t("organization.teamMembers.inviteTeamMember")}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={inviteForm.handleSubmit(handleInvite)}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.teamMembers.emailLabel")}
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    {...inviteForm.register("email", {
                      required: t("organization.teamMembers.emailRequired"),
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: t("organization.teamMembers.emailInvalid"),
                      },
                    })}
                    placeholder={t("organization.teamMembers.emailPlaceholder")}
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
                    htmlFor="invite-role"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {t("organization.teamMembers.roleLabel")}
                  </label>
                  <select
                    id="invite-role"
                    {...inviteForm.register("role", { required: true })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  >
                    <option value="ADMIN">
                      {t("organization.teamMembers.roleAdmin")}
                    </option>
                    <option value="LEAD_AUDITOR">
                      {t("organization.teamMembers.roleLeadAuditor")}
                    </option>
                    <option value="LIGHT_USER">
                      {t("organization.teamMembers.roleLightUser")}
                    </option>
                    <option value="VIEWER">
                      {t("organization.teamMembers.roleViewer")}
                    </option>
                  </select>
                </div>
              </div>

              <DialogFooter className="mt-8 flex flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {t("organization.teamMembers.cancel")}
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
                  {t("organization.teamMembers.sendInvitation")}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
