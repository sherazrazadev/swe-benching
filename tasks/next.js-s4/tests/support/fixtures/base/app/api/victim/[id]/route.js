export const revalidate = 3600

export async function generateStaticParams() {
  return [{ id: 'known' }, { id: 'known-b' }]
}

export async function GET(_request, { params }) {
  const p = await params
  return Response.json(
    { route: 'route-victim', params: p },
    { headers: { 'x-route': 'route-victim' } }
  )
}
