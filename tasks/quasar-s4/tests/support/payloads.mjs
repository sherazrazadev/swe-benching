// Attack shapes used by the security suite. Kept in their own module so a literal payload
// never appears in the source window that the error page quotes as a stack listing.
const tag = 'img src=x id=' + 'gate_marker_9f3c'

export const MARKER = 'gate_marker_9f3c'

export const mixedCaseClose = '</ScRiPt><' + tag + '>'
export const spacedClose = '</script ><' + tag + '>'
export const selfClosingClose = '</script/><' + tag + '>'
export const quoteBreakout = "' onmouseover='" + MARKER
export const cookieBreakout = 'cookie=' + mixedCaseClose
