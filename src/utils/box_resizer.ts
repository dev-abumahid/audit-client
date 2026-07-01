export const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}
