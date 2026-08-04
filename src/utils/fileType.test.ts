import { fileType } from "./fileType"

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
