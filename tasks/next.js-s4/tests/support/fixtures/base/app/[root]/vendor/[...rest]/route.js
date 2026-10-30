export const revalidate = 3600

export async function generateStaticParams() {
  return []
}

export async function GET(_request, { params }) {
  const p = await params
  return Response.json(
    { route: 'route-catchall', params: p },
    { headers: { 'x-route': 'route-catchall' } }
  )
}
