import { createSlice } from "@reduxjs/toolkit"

export interface IUser {
  email: string
  id: string
  role: string
  provider: string
  userProfile?: {
    fullName: string
    profilePhoto: string
  }
  organizationProfile?: {
    organizationName: string
    organizationLogo: string
  }
}

const initialState: IUser = {
  email: "",
  id: "",
  role: "",
  provider: "",
  userProfile: {
    fullName: "",
    profilePhoto: "",
  },
  organizationProfile: {
    organizationName: "",
    organizationLogo: "",
  },
}

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.email = action.payload.email
      state.id = action.payload.id
      state.role = action.payload.role
      state.provider = action.payload.provider
      state.userProfile = action.payload.userProfile
      state.organizationProfile = action.payload.organizationProfile
    },
    removeUser: (state) => {
      state.email = ""
      state.id = ""
      state.role = ""
      state.provider = ""
      state.userProfile = {
        fullName: "",
        profilePhoto: "",
      }
      state.organizationProfile = {
        organizationName: "",
        organizationLogo: "",
      }
    },
  },
})

// Action creators are generated for each case reducer function
export const { setUser, removeUser } = userSlice.actions

export const userReducer = userSlice.reducer
