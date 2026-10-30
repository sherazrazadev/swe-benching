import { defineEventHandler, getQuery, sendRedirect } from 'h3'

// Same-origin helper that redirects to a caller-provided location.
export default defineEventHandler((event) => {
  const to = String(getQuery(event).to || '/')
  return sendRedirect(event, to, 302)
})
