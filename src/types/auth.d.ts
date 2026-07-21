// Confirmed against the real Account/Profile/OrganizationProfile Prisma
// models + account.service.ts (issue #108, module is named "account"
// server-side but mounted at /auth).

export type AccountRole = "ADMIN" | "USER" | "ORGANIZATION"
export type AccountProvider =
  | "LOCAL"
  | "GOOGLE"
  | "FACEBOOK"
  | "GITHUB"
  | "TWITTER"
  | "LINKEDIN"
  | "INSTAGRAM"

// POST /auth/sign-in's response `data`. login_user_into_db reads
// `account.profile?.fullName`/`account.organizationProfile?.organizationName`
// with optional chaining (an ORGANIZATION-role account may have no personal
// Profile row, only an OrganizationProfile, and vice versa for USER/ADMIN),
// so these can genuinely be undefined on the wire -- not just theoretically
// per the schema. The access token itself is never in this body; it's set
// as an httpOnly `access_token` cookie server-side.
export interface SignInResult {
  email: string
  id: string
  role: AccountRole
  provider: AccountProvider
  userProfile: {
    fullName: string | undefined
    profilePhoto: string | null | undefined
  }
  organizationProfile: {
    organizationName: string | undefined
    organizationLogo: string | null | undefined
  }
}

// POST /auth/sign-up's response `data` (create_account_into_db's return:
// `{ account, profile }`, both raw Prisma rows with no `select`).
//
// SECURITY NOTE: the real `account` row returned by the backend here
// includes `password` (the bcrypt hash) -- confirmed in
// account.service.ts's create_account_into_db, which returns the full
// `tx.account.create(...)` result with no select/omit. This frontend type
// deliberately does NOT declare that field, since nothing here should ever
// read or store it; it's flagged as a backend finding worth its own fix
// (select the response down server-side) rather than something this
// typing pass silently works around. No current frontend consumer reads
// `res.data` from this endpoint at all (SignUpModal.tsx only checks
// `res.success`/`res.message`).
export interface SignUpResult {
  account: {
    id: string
    email: string
    role: AccountRole
    provider: AccountProvider
    isAccountVerified: boolean
    isDeleted: boolean
    createdAt: string
    updatedAt: string
  }
  profile: {
    id: string
    accountId: string
    organizationName: string
    organizationLogo: string | null
    organizationLocation: string | null
    organizationDescription: string | null
    organizationWebsite: string | null
    organizationPhone: string | null
  }
}

// GET /auth/me's response `data` (get_user_account_from_db's select).
export interface MeAccount {
  id: string
  email: string
  role: AccountRole
  isAccountVerified: boolean
  isDeleted: boolean
  profile: {
    id: string
    accountId: string
    fullName: string
    profilePhoto: string | null
  } | null
  organizationProfile: {
    id: string
    accountId: string
    organizationName: string
    organizationLogo: string | null
    organizationLocation: string | null
    organizationDescription: string | null
    organizationWebsite: string | null
    organizationPhone: string | null
  } | null
}
