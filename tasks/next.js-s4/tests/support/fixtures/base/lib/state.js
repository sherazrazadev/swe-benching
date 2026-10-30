export function state(route, params) {
  return {
    route,
    params: params || {},
    generation: `${Date.now()}-${Math.random()}`,
  }
}

export function State({ value }) {
  return <div id="route-state">{JSON.stringify(value)}</div>
}
