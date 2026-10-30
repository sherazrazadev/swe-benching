// Hidden functional tests: the behaviour that must keep working while wildcard
// names and name constraints are evaluated correctly.

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
fn exact_name_permitted() {
    assert!(validates(
        der!("fun_exact_permitted/root.der"),
        der!("fun_exact_permitted/leaf.der"),
        Some(der!("fun_exact_permitted/inter.der")),
        "foo.example.com",
    ));
}

#[test]
fn exact_name_excluded() {
    assert!(!validates(
        der!("fun_exact_excluded/root.der"),
        der!("fun_exact_excluded/leaf.der"),
        Some(der!("fun_exact_excluded/inter.der")),
        "bad.example.com",
    ));
}

#[test]
fn wildcard_permitted_by_base() {
    assert!(validates(
        der!("fun_wildcard_permitted/root.der"),
        der!("fun_wildcard_permitted/leaf.der"),
        Some(der!("fun_wildcard_permitted/inter.der")),
        "bar.example.com",
    ));
}

#[test]
fn wildcard_permitted_by_multi_label_base() {
    assert!(validates(
        der!("fun_wildcard_multilabel_permitted/root.der"),
        der!("fun_wildcard_multilabel_permitted/leaf.der"),
        Some(der!("fun_wildcard_multilabel_permitted/inter.der")),
        "a.foo.example.com",
    ));
}

#[test]
fn wildcard_overlapping_excluded() {
    assert!(
        !validates(
            der!("fun_wildcard_excluded_overlap/root.der"),
            der!("fun_wildcard_excluded_overlap/leaf.der"),
            Some(der!("fun_wildcard_excluded_overlap/inter.der")),
            "baz.example.com",
        ),
        "a wildcard overlapping an excluded subtree must stay excluded"
    );
}

#[test]
fn wildcard_not_overlapping_excluded() {
    assert!(validates(
        der!("fun_wildcard_not_excluded/root.der"),
        der!("fun_wildcard_not_excluded/leaf.der"),
        Some(der!("fun_wildcard_not_excluded/inter.der")),
        "qux.example.com",
    ));
}

#[test]
fn permitted_subtree_case_insensitive() {
    assert!(validates(
        der!("fun_case_insensitive/root.der"),
        der!("fun_case_insensitive/leaf.der"),
        Some(der!("fun_case_insensitive/inter.der")),
        "bar.example.com",
    ));
}

#[test]
fn subject_matches_single_wildcard_label() {
    assert!(validates(
        der!("fun_hostname_one_label/root.der"),
        der!("fun_hostname_one_label/leaf.der"),
        None,
        "bar.example.com",
    ));
}
