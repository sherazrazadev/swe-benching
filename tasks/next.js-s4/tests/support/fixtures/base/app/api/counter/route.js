export const dynamic = 'force-dynamic'

let counter = 0

export async function GET() {
  counter += 1
  return Response.json({ count: counter })
}
