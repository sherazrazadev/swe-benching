"""Functional cases: every supported partial-pipeline resume still works.

The suite drives the same entry points as a framework integration would: a
stored flow resumed in the session that started it, the configuration and
argument shapes the public utility accepts, the low-level and provider resume
hooks, the disconnect action, and the product's out-of-band validation flow
completed from a fresh session.
"""
import unittest

from support import harness
from social_core.actions import do_complete, do_disconnect
from social_core.backends.facebook_limited import FacebookLimitedLogin
from social_core.pipeline.utils import partial_resume
from social_core.utils import PARTIAL_TOKEN_SESSION_NAME, partial_pipeline_data

EMAIL_PIPELINE = (
    f"{harness.__name__}.set_details",
    "social_core.pipeline.mail.mail_validation",
    f"{harness.__name__}.record_run",
    f"{harness.__name__}.login_user",
)

EMAIL_SETTINGS = {
    "SOCIAL_AUTH_PIPELINE": EMAIL_PIPELINE,
    "SOCIAL_AUTH_EMAIL_VALIDATION_URL": "/validate",
}


class ResumeFlowsTest(unittest.TestCase):
    def setUp(self) -> None:
        harness.reset()

    def _started_flow(self, settings=None, name="probe"):
        session = harness.new_session(settings)
        backend = harness.new_backend(session, name)
        session.authenticate(backend, response={})
        token = session.session_get(PARTIAL_TOKEN_SESSION_NAME)
        self.assertIsNotNone(token)
        return session, backend, token

    def test_session_token_resumes_the_flow(self):
        session, backend, _token = self._started_flow()
        session.set_request_data({"password": "chosen"}, backend)

        do_complete(backend, login=harness.noop_login)

        self.assertEqual("alice", session.session_get("logged_in"))
        self.assertEqual("alice", session.session_get("username"))

    def test_request_token_equal_to_the_session_token_resumes(self):
        session, backend, token = self._started_flow()
        session.set_request_data({"partial_token": token, "password": "chosen"}, backend)

        do_complete(backend, login=harness.noop_login)

        self.assertEqual("alice", session.session_get("logged_in"))

    def test_configured_token_field_of_the_same_session_resumes(self):
        session, backend, token = self._started_flow(
            {"SOCIAL_AUTH_PARTIAL_PIPELINE_TOKEN_NAME": "resume"}
        )
        session.set_request_data({"resume": token, "password": "chosen"}, backend)

        do_complete(backend, login=harness.noop_login)

        self.assertEqual("alice", session.session_get("logged_in"))

    def test_explicit_token_argument_of_the_same_session_resumes(self):
        session, backend, token = self._started_flow()
        session.set_request_data({"password": "chosen"}, backend)

        partial = partial_pipeline_data(backend, None, token)
        self.assertIsNotNone(partial)
        backend.continue_pipeline(partial)

        self.assertEqual("alice", session.session_get("username"))

    def test_low_level_resume_hook_resumes_the_owning_session(self):
        session, backend, token = self._started_flow()
        session.set_request_data({"password": "chosen"}, backend)

        partial = session.partial_load(token)
        self.assertIsNotNone(partial)
        backend.continue_pipeline(partial)

        self.assertEqual("alice", session.session_get("username"))

    def test_pipeline_helper_resumes_the_owning_session(self):
        session, backend, token = self._started_flow()
        session.set_request_data({"password": "chosen"}, backend)

        partial_resume(session, backend, token)

        self.assertEqual("alice", session.session_get("username"))

    def test_provider_resume_override_resumes_the_owning_session(self):
        session, _backend, token = self._started_flow(name="facebook-limited-login")
        session.set_request_data({"password": "chosen"})

        partial = session.partial_load(token)
        self.assertIsNotNone(partial)
        FacebookLimitedLogin(session).continue_pipeline(partial)

        self.assertTrue(
            [entry for entry in harness.RUNS if entry.get("pipeline_index") == 1],
            "the stored flow did not run the step after the one it stopped at",
        )

    def test_disconnect_resumes_the_owning_sessions_flow(self):
        settings = {"SOCIAL_AUTH_DISCONNECT_PIPELINE": (f"{harness.__name__}.record_disconnect",)}
        session = harness.new_session(settings)
        backend = harness.new_backend(session)
        session.authenticate(backend, response={}, flow_owner="owning-session")
        token = session.session_get(PARTIAL_TOKEN_SESSION_NAME)
        self.assertIsNotNone(token)
        session.set_request_data({"partial_token": token}, backend)
        user = harness.User("victim")
        harness.DISCONNECTS.clear()

        do_disconnect(backend, user)

        self.assertIn(
            "owning-session",
            [entry.get("marker") for entry in harness.DISCONNECTS],
            "the disconnect handler did not receive the stored flow it owns",
        )

    def test_out_of_band_flow_completes_from_a_fresh_session(self):
        attacker = harness.new_session(EMAIL_SETTINGS)
        attacker_backend = harness.new_backend(
            attacker, "probe-email", requires_email_validation=True
        )
        attacker.authenticate(attacker_backend, response={}, is_new=True)
        token = attacker.session_get(PARTIAL_TOKEN_SESSION_NAME)
        self.assertIsNotNone(token)
        self.assertEqual(1, len(harness.SENT_EMAILS))
        code = harness.SENT_EMAILS[0]["code"]

        fresh = harness.new_session(EMAIL_SETTINGS)
        fresh_backend = harness.new_backend(
            fresh, "probe-email", requires_email_validation=True
        )
        fresh.set_request_data(
            {"partial_token": token, "verification_code": code}, fresh_backend
        )

        response = do_complete(fresh_backend, login=harness.noop_login)
        if isinstance(response, harness.ConfirmPage):
            # A confirmation-based design is also correct: the product asks the
            # fresh session to confirm, then completes on that confirmation.
            fresh.set_request_data({"partial_pipeline_confirm": "1"}, fresh_backend)
            do_complete(fresh_backend, login=harness.noop_login)

        self.assertEqual("alice", fresh.session_get("logged_in"))
        self.assertEqual("alice", fresh.session_get("username"))
