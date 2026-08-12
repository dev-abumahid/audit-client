import { fileType, getMediaKindFromMime } from "./fileType"

describe("fileType", () => {
  it("classifies common image extensions as image", () => {
    expect(fileType("https://cdn.example.com/photo.jpg")).toBe("image")
    expect(fileType("https://cdn.example.com/photo.PNG")).toBe("image")
  })

  it("classifies common video extensions as video", () => {
    expect(fileType("https://cdn.example.com/clip.mp4")).toBe("video")
    expect(fileType("https://cdn.example.com/clip.mov")).toBe("video")
  })

  it("classifies pdf and document extensions as document", () => {
    expect(fileType("https://cdn.example.com/report.pdf")).toBe("document")
    expect(fileType("https://cdn.example.com/report.docx")).toBe("document")
  })

  it("falls back to file for unknown extensions", () => {
    expect(fileType("https://cdn.example.com/archive.zip")).toBe("file")
  })

  it("ignores query strings when determining the extension", () => {
    expect(fileType("https://cdn.example.com/photo.jpg?token=abc")).toBe(
      "image"
    )
  })
})

// quality-bar-loop (Inspections, round 45, code-quality finding): extracted
// from CreateNewInspection.tsx's/UpdateInspection.tsx's handleExternalMediaUpload,
// where this exact ternary was independently copy-pasted twice.
describe("getMediaKindFromMime", () => {
  it("classifies any video/* MIME type as video", () => {
    expect(getMediaKindFromMime("video/mp4")).toBe("video")
    expect(getMediaKindFromMime("video/quicktime")).toBe("video")
    expect(getMediaKindFromMime("video/webm")).toBe("video")
  })

  it("classifies application/pdf as document", () => {
    expect(getMediaKindFromMime("application/pdf")).toBe("document")
  })

  // Matches the original inline ternary's fallthrough exactly -- anything
  // that isn't video/* or application/pdf defaults to "image", including
  // MIME types that aren't actually images.
  it("falls back to image for anything else, matching the original ternary's default", () => {
    expect(getMediaKindFromMime("image/png")).toBe("image")
    expect(getMediaKindFromMime("application/zip")).toBe("image")
    expect(getMediaKindFromMime("")).toBe("image")
  })
})
