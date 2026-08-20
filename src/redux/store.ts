import { configureStore } from "@reduxjs/toolkit"
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist"
import storage from "redux-persist/lib/storage"
import { baseApi } from "./baseApi"
import { aiRiskAnalysisRunReducer } from "./slices/aiRiskAnalysisRun.slice"
import { externalUserReducer } from "./slices/externalUser.slice"
import { userReducer } from "./slices/user.slice"

// persist config
const persistConfig = {
  key: "user",
  storage,
}

// aexa-frontend#216 -- separate persisted key from "user" above, since an
// external Light User's session is entirely independent of an internal
// account's (see externalUser.slice.ts's own comment).
const externalUserPersistConfig = {
  key: "externalUser",
  storage,
}

const userPersistReducer = persistReducer(persistConfig, userReducer)
const externalUserPersistReducer = persistReducer(
  externalUserPersistConfig,
  externalUserReducer
)

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    user: userPersistReducer,
    externalUser: externalUserPersistReducer,
    // Not persisted -- surviving in-session navigation (aexa-frontend#924)
    // is the goal, not surviving a hard reload.
    aiRiskAnalysisRun: aiRiskAnalysisRunReducer,
  },
  middleware: (getDefaultMiddlewares) =>
    getDefaultMiddlewares({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const persistor = persistStore(store)
