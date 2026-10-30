import { state, State } from '../../lib/state'

export default function Page(props) {
  return <State value={props} />
}

export function getStaticPaths() {
  return {
    paths: ['known', 'known-b'].map((id) => ({ params: { id } })).concat([{ params: { id: 'missing-1' } }]),
    fallback: 'blocking',
  }
}

export function getStaticProps({ params }) {
  if (params.id.startsWith('missing-')) return { notFound: true, revalidate: 3600 }
  return {
    props: state('victim', params),
    revalidate: params.id.startsWith('fast-') ? 1 : 3600,
  }
}
