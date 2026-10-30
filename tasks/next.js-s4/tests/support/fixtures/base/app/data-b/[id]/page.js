export const dynamic = 'force-dynamic'

export default async function Page({ params }) {
  const p = await params
  const response = await fetch(`${process.env.SELF_URL}/api/counter`, {
    cache: 'force-cache',
  })
  const data = await response.json()
  return (
    <div id="route-state">
      {JSON.stringify({ route: 'data-b', id: p.id, count: data.count })}
    </div>
  )
}
