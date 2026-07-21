import { baseApi } from "../baseApi"
import type { ApiResponse } from "@/types/api"

const commonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Returns the uploaded file's Cloudinary secure_url as a bare string
    // (see inspection.service.ts's upload_any_file_into_aws_for_inspection
    // -- `return result.secure_url`), not `{ url: string }`. Every consumer
    // already read `res.data` directly as the URL, matching this.
    uploadAnyFileAws: builder.mutation<ApiResponse<string>, FormData>({
      query: (data) => ({
        url: "/inspection/upload-file-aws",
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const { useUploadAnyFileAwsMutation } = commonApi
