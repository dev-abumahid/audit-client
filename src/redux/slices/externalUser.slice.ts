import { createSlice } from "@reduxjs/toolkit"

// aexa-frontend#216 -- a separate, minimal session slice for an external
// Light User, deliberately NOT folded into user.slice.ts's IUser: the
// external JWT/cookie is a structurally distinct token type from an internal
// account's (see auth_external.ts on aexa-server), and ProtectedRoute.tsx's
// role union has no external variant. organizationId is kept here too so a
// logged-in external member's own login link can be reconstructed (e.g. for
// a "sign in as someone else" flow later) without depending on the route
// params still being present.
export interface IExternalUser {
  externalOrgMemberId: string
  organizationId: string
  email: string
  fullName: string | null
}

const initialState: IExternalUser = {
  externalOrgMemberId: "",
  organizationId: "",
  email: "",
  fullName: null,
}

export const externalUserSlice = createSlice({
  name: "externalUser",
  initialState,
  reducers: {
    setExternalUser: (state, action: { payload: IExternalUser }) => {
      state.externalOrgMemberId = action.payload.externalOrgMemberId
      state.organizationId = action.payload.organizationId
      state.email = action.payload.email
      state.fullName = action.payload.fullName
    },
    removeExternalUser: (state) => {
      state.externalOrgMemberId = ""
      state.organizationId = ""
      state.email = ""
      state.fullName = null
    },
  },
})

export const { setExternalUser, removeExternalUser } =
  externalUserSlice.actions

export const externalUserReducer = externalUserSlice.reducer
