/* eslint-disable @typescript-eslint/no-explicit-any */
export const removeNulls = (obj: any): any => {
  if (obj === null) return undefined
  if (typeof obj === "object" && !Array.isArray(obj)) {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = typeof value === "object" ? removeNulls(value) : value
      }
    }
    return result
  }
  return obj
}
