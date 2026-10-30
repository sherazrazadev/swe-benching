import { state, State } from '../lib/state'

export default function Page() {
  return <State value={state('home')} />
}
