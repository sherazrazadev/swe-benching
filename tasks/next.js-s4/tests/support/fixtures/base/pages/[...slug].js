import { state, State } from '../lib/state'

export default function Page(props) {
  return <State value={props} />
}

export function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export function getStaticProps({ params }) {
  return { props: state('pages-catchall', params), revalidate: 3600 }
}
