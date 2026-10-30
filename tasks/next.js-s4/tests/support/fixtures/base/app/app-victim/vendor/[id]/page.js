export const revalidate = 3600

export async function generateStaticParams() {
  return [{ id: 'known' }]
}

export default async function Page({ params }) {
  const p = await params
  return (
    <div id="route-state">
      {JSON.stringify({
        route: 'app-vendor',
        params: p,
        generation: `${Date.now()}-${Math.random()}`,
      })}
    </div>
  )
}
