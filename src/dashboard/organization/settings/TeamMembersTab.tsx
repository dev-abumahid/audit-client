import { Loader2, Mail, Plus, RotateCcw, ShieldOff, UserPlus, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  useGetAllOrgUsersQuery,
  useGetPendingInvitationsQuery,
  useInviteMemberMutation,
  useResendInvitationMutation,
  useUpdateOrgMemberMutation,
} from "@/redux/apis/organization/org.user.api"

interface InviteFormValues {
  email: string
  role: "ADMIN" | "LEAD_AUDITOR" | "LIGHT_USER" | "VIEWER"
}

interface OrgMember {
  id: string
  role: string
  status: string
  isExpired: boolean
  account?: { email?: string; profile?: { fullName?: string } }
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  expiresAt: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  LEAD_AUDITOR: "Lead Auditor",
  LIGHT_USER: "Light User",
  VIEWER: "Viewer",
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {ROLE_LABELS[role] ?? role}
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
  if (isExpired) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Expired
      </span>
    )
  }
  if (status === "SUSPENDED") {
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        Suspended
      </span>
    )
  }
  return (
    <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
      Active
    </span>
  )
}

export default function TeamMembersTab() {
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
        toast.success(`Invitation sent to ${values.email}`)
        setShowInviteForm(false)
      }
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to send invitation"
      toast.error(message)
    }
  }

  const handleToggleStatus = async (member: OrgMember) => {
    const nextStatus = member.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"
    setMutatingMemberId(member.id)
    try {
      await updateOrgMember({ id: member.id, body: { status: nextStatus } }).unwrap()
      toast.success(
        nextStatus === "SUSPENDED" ? "Member suspended" : "Member reactivated"
      )
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to update member status"
      toast.error(message)
    } finally {
      setMutatingMemberId(null)
    }
  }

  const handleResend = async (invitation: PendingInvitation) => {
    setResendingId(invitation.id)
    try {
      await resendInvitation(invitation.id).unwrap()
      toast.success(`Invitation resent to ${invitation.email}`)
    } catch (err: unknown) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to resend invitation"
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
        Failed to load team members. Please try again later.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Team Members
          </h3>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} in
            your organization
          </p>
        </div>
        <button
          onClick={openInvite}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground uppercase">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
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
                <tr key={member.id} className="border-b border-border last:border-0">
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
                    <button
                      onClick={() => handleToggleStatus(member)}
                      disabled={isMutating || reactivateBlockedByExpiry}
                      title={
                        reactivateBlockedByExpiry
                          ? "This member's access window has also expired — reactivating won't restore access."
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
                      {member.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </button>
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
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!invitationsLoading && invitations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <h4 className="text-sm font-semibold text-foreground">
              Pending Invitations
            </h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invite) => (
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
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleResend(invite)}
                      disabled={resendingId === invite.id}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resendingId === invite.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInviteForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowInviteForm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                Invite Team Member
              </h2>
              <button
                onClick={() => setShowInviteForm(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={inviteForm.handleSubmit(handleInvite)}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    {...inviteForm.register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email address",
                      },
                    })}
                    placeholder="teammate@company.com"
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  />
                  {inviteForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-destructive">
                      {inviteForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Role *
                  </label>
                  <select
                    {...inviteForm.register("role", { required: true })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="LEAD_AUDITOR">Lead Auditor</option>
                    <option value="LIGHT_USER">Light User</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
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
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
