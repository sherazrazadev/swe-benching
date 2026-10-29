import nock from 'nock';

export type RecordedRequest = {
  method: string;
  path: string;
  authorization: string;
};

const ZERO_DIGEST =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';

// A registry that answers the whole attach flow and records the credentials
// every request carries. The registry challenges for basic auth so the client
// has to authenticate.
export const fakeRegistry = (
  host: string,
  repository: string,
  imageDigest: string,
  seen: RecordedRequest[]
): void => {
  const base = `https://${host}`;

  nock(base)
    .post(`/v2/${repository}/blobs/uploads/`)
    .reply(401, {}, { 'WWW-Authenticate': 'Basic realm="registry"' });

  nock(base)
    .head(`/v2/${repository}/manifests/${imageDigest}`)
    .reply(function (this: any) {
      seen.push({
        method: String(this.req.method),
        path: String(this.req.path),
        authorization: String(this.req.headers.authorization || ''),
      });
      return [
        200,
        {},
        {
          'Docker-Content-Digest': imageDigest,
          'Content-Type': 'application/vnd.oci.image.manifest.v1+json',
          'Content-Length': '2',
        },
      ];
    });

  nock(base)
    .head(new RegExp(`/v2/${repository}/blobs/sha256:[0-9a-f]{64}$`))
    .reply(404)
    .persist();

  nock(base)
    .post(`/v2/${repository}/blobs/uploads/`)
    .reply(202, {}, { Location: `/v2/${repository}/blobs/uploads/session` })
    .persist();

  nock(base)
    .put(`/v2/${repository}/blobs/uploads/session`)
    .query(true)
    .reply(201)
    .persist();

  nock(base)
    .put(new RegExp(`/v2/${repository}/manifests/.*`))
    .reply(201, {}, { 'OCI-Subject': 'sha256:cafed00d' });

  nock(base).get(`/v2/${repository}/referrers/${ZERO_DIGEST}`).reply(200, {});
};
