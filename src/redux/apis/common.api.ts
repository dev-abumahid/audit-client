import { baseApi } from "../baseApi"

const commonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // sign in route
    uploadAnyFileAws: builder.mutation({
      query: (data) => ({
        url: "/inspection/upload-file-aws",
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const { useUploadAnyFileAwsMutation } = commonApi
