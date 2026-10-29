"""Shared harness for the hidden suites.

Builds a small, real deployment of the product's Flask integration: an
authorization endpoint wired exactly the way the library documents it, a
public client, a confidential client and an OpenID Connect server.  Nothing
here asserts; the tests own every expectation so that a hardened product
cannot crash this module.
"""

import json
import os
from pathlib import Path

os.environ.setdefault("AUTHLIB_INSECURE_TRANSPORT", "true")

from flask import Flask
from flask import request

from authlib.integrations.flask_oauth2 import AuthorizationServer
from authlib.jose import jwt
from authlib.oauth2 import OAuth2Error
from authlib.oauth2.rfc6749.grants import AuthorizationCodeGrant
from authlib.oauth2.rfc6749.grants import ImplicitGrant
from authlib.oidc.core import UserInfo
from authlib.oidc.core.grants import OpenIDHybridGrant
from authlib.oidc.core.grants import OpenIDImplicitGrant

KEYS = Path(__file__).with_name("keys")
PRIVATE_JWK = json.loads((KEYS / "jwk_private.json").read_text())
PUBLIC_JWK = json.loads((KEYS / "jwk_public.json").read_text())

JWT_CONFIG = {
    "key": "harness-secret",
    "alg": "HS256",
    "iss": "https://server.invalid",
    "exp": 3600,
}

ALL_RESPONSE_TYPES = [
    "code",
    "token",
    "id_token",
    "id_token token",
    "code id_token",
    "code token",
    "code id_token token",
]


class Client:
    """A client registered on the server (the product's ClientMixin contract)."""

    def __init__(
        self,
        client_id,
        redirect_uris,
        response_types=None,
        grant_types=None,
        scope="openid profile email",
        token_endpoint_auth_method="none",
        client_secret="secret",
    ):
        self.client_id = client_id
        self.redirect_uris = list(redirect_uris)
        self.response_types = (
            list(response_types) if response_types is not None else list(ALL_RESPONSE_TYPES)
        )
        self.grant_types = (
            list(grant_types)
            if grant_types is not None
            else ["authorization_code", "implicit"]
        )
        self.scope = scope
        self.token_endpoint_auth_method = token_endpoint_auth_method
        self.client_secret = client_secret

    def get_client_id(self):
        return self.client_id

    def get_default_redirect_uri(self):
        if self.redirect_uris:
            return self.redirect_uris[0]
        return None

    def get_allowed_scope(self, scope):
        return scope or ""

    def check_redirect_uri(self, redirect_uri):
        return redirect_uri in self.redirect_uris

    def check_client_secret(self, client_secret):
        return self.client_secret == client_secret

    def check_endpoint_auth_method(self, method, endpoint):
        if endpoint == "token":
            return self.token_endpoint_auth_method == method
        return True

    def check_response_type(self, response_type):
        return response_type in self.response_types

    def check_grant_type(self, grant_type):
        return grant_type in self.grant_types


class User:
    def __init__(self, user_id="user-1", name="Test User"):
        self.user_id = user_id
        self.name = name

    def get_user_id(self):
        return self.user_id

    def generate_user_info(self, scope):
        return UserInfo(sub=self.user_id, name=self.name)


class HarnessServer(AuthorizationServer):
    def __init__(self, app, clients):
        self.clients = clients
        self.issued_tokens = []
        self.issued_codes = []
        super().__init__(app, self.query_client, self.save_token)

    def query_client(self, client_id):
        return self.clients.get(client_id)

    def save_token(self, token, request):
        self.issued_tokens.append(dict(token))


class _CodeGrant(AuthorizationCodeGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"]

    def save_authorization_code(self, code, request):
        self.server.issued_codes.append(
            {
                "code": code,
                "client_id": request.payload.client_id,
                "redirect_uri": request.payload.redirect_uri,
            }
        )

    def authenticate_user(self, authorization_code):
        return User()


class _ImplicitGrant(ImplicitGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"]


class _OpenIDImplicitGrant(OpenIDImplicitGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"]

    def get_jwt_config(self, client):
        return dict(JWT_CONFIG)

    def generate_user_info(self, user, scope):
        return user.generate_user_info(scope)

    def exists_nonce(self, nonce, request):
        return False


class _OpenIDHybridGrant(OpenIDHybridGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["none", "client_secret_basic", "client_secret_post"]

    def get_jwt_config(self, client):
        return dict(JWT_CONFIG)

    def generate_user_info(self, user, scope):
        return user.generate_user_info(scope)

    def exists_nonce(self, nonce, request):
        return False

    def save_authorization_code(self, code, request):
        self.server.issued_codes.append(
            {
                "code": code,
                "client_id": request.payload.client_id,
                "redirect_uri": request.payload.redirect_uri,
            }
        )


def build_app(clients, extensions=()):
    """Return (flask_app, server) with the documented authorization route."""
    app = Flask(__name__)
    app.debug = False
    app.testing = True
    app.secret_key = "harness"
    app.config.update({"OAUTH2_ERROR_URIS": []})

    server = HarnessServer(app, clients)
    server.register_grant(_CodeGrant)
    server.register_grant(_ImplicitGrant)
    server.register_grant(_OpenIDImplicitGrant)
    server.register_grant(_OpenIDHybridGrant)
    for extension in extensions:
        server.register_extension(extension)

    @app.route("/oauth/authorize", methods=["GET", "POST"])
    def authorize():
        user_id = request.values.get("user_id")
        end_user = User() if user_id else None
        try:
            grant = server.get_consent_grant(end_user=end_user)
        except OAuth2Error as error:
            return server.handle_error_response(request, error)
        if request.method == "GET":
            return grant.prompt or "ok"
        return server.create_authorization_response(grant=grant, grant_user=end_user)

    return app, server


class RequestObjectExtension:
    """Factory for the product's JWT-secured authorization request extension."""

    @staticmethod
    def make():
        from authlib.oauth2 import rfc9101

        class HarnessRequestObject(rfc9101.JWTAuthenticationRequest):
            def resolve_client_public_key(self, client):
                return PUBLIC_JWK

            def get_request_object(self, request_uri):
                return None

            def get_server_metadata(self):
                return {}

            def get_client_require_signed_request_object(self, client):
                return False

        return HarnessRequestObject()


def sign_request_object(claims):
    return jwt.encode({"alg": "RS256"}, claims, PRIVATE_JWK)
