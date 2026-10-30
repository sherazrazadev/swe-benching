// Hidden security tests: X.509 path validation must never accept a DNS name
// outside the scope a wildcard stands for, or outside a CA's permitted names.

use cryptography_x509::certificate::Certificate;
use cryptography_x509_verification::ops::{CryptoOps, VerificationCertificate};
use cryptography_x509_verification::policy::{Policy, PolicyDefinition, Subject};
use cryptography_x509_verification::trust_store::Store;
use cryptography_x509_verification::types::DNSName;
use cryptography_x509_verification::verify;

macro_rules! der {
    ($p:expr) => {
        include_bytes!(concat!("fixtures/", $p)) as &[u8]
    };
}

struct TestOps;

impl CryptoOps for TestOps {
    type Key = ();
    type Err = ();
    type CertificateExtra = ();
    type PolicyExtra = ();

    fn public_key(&self, _cert: &Certificate<'_>) -> Result<Self::Key, Self::Err> {
        Ok(())
    }

    fn verify_signed_by(&self, _cert: &Certificate<'_>, _key: &Self::Key) -> Result<(), Self::Err> {
        Ok(())
    }

    fn clone_public_key(_key: &Self::Key) -> Self::Key {}

    fn clone_extra(_extra: &Self::CertificateExtra) -> Self::CertificateExtra {}
}

/// Runs the crate's public path-validation entry point for a server name and
/// returns true when a chain is accepted.
fn validates(
    root_der: &[u8],
    leaf_der: &[u8],
    inter_der: Option<&[u8]>,
    server_name: &str,
) -> bool {
    let root: Certificate<'_> = asn1::parse_single(root_der).expect("root");
    let leaf: Certificate<'_> = asn1::parse_single(leaf_der).expect("leaf");
    let intermediate: Option<Certificate<'_>> = inter_der.map(|d| asn1::parse_single(d).expect("inter"));

    let root_vc = VerificationCertificate::<TestOps>::new(&root, ());
    let store = Store::new([root_vc]);
    let leaf_vc = VerificationCertificate::<TestOps>::new(&leaf, ());
    let intermediate_vcs: Vec<VerificationCertificate<TestOps>> = intermediate
        .iter()
        .map(|cert| VerificationCertificate::new(cert, ()))
        .collect();

    let definition = PolicyDefinition::server(
        TestOps,
        Subject::DNS(DNSName::new(server_name).expect("server name")),
        asn1::DateTime::new(2030, 1, 1, 0, 0, 0).expect("time"),
        None,
        None,
        None,
    )
    .expect("policy");

    let policy = Policy::new(&definition, ());
    verify(&leaf_vc, &intermediate_vcs, &policy, &store).is_ok()
}

#[test]
fn permitted_wildcard_escape() {
    assert!(
        !validates(
            der!("main_permitted/root.der"),
            der!("main_permitted/leaf.der"),
            Some(der!("main_permitted/inter.der")),
            "bar.example.com",
        ),
        "a wildcard covering names outside a permitted subtree was accepted"
    );
}

#[test]
fn permitted_wildcard_escape_multilabel() {
    assert!(
        !validates(
            der!("main_permitted_multilabel/root.der"),
            der!("main_permitted_multilabel/leaf.der"),
            Some(der!("main_permitted_multilabel/inter.der")),
            "x.foo.example.com",
        ),
        "a multi-label wildcard covering names outside a permitted subtree was accepted"
    );
}

#[test]
fn permitted_wildcard_escape_mixed_case() {
    assert!(
        !validates(
            der!("main_permitted_case/root.der"),
            der!("main_permitted_case/leaf.der"),
            Some(der!("main_permitted_case/inter.der")),
            "bar.example.com",
        ),
        "a wildcard outside a permitted subtree was accepted when names differed in case"
    );
}

#[test]
fn selfissued_wildcard_permitted_escape() {
    assert!(
        !validates(
            der!("selfissued_wildcard/root.der"),
            der!("selfissued_wildcard/leaf.der"),
            None,
            "bar.example.com",
        ),
        "a wildcard outside the permitted names of a self-issued CA was accepted"
    );
}

#[test]
fn selfissued_exact_permitted_escape() {
    assert!(
        !validates(
            der!("selfissued_exact/root.der"),
            der!("selfissued_exact/leaf.der"),
            None,
            "evil.example.com",
        ),
        "an exact name outside the permitted names of a self-issued CA was accepted"
    );
}

#[test]
fn subject_matching_beyond_wildcard_label() {
    assert!(
        !validates(
            der!("hostname_deep/root.der"),
            der!("hostname_deep/leaf.der"),
            None,
            "a.b.example.com",
        ),
        "a wildcard was treated as covering a name with more than one label"
    );
}
