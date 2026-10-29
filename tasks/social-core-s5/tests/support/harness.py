"""Self-contained test harness for the partial-pipeline resume task.

Only product modules are imported from the checkout under test; every storage,
strategy, response and backend object here belongs to the test, so a change to
the product cannot alter how the tests compute or clean up.
"""
from __future__ import annotations

from typing import Any

from social_core.exceptions import AuthFailed, SocialAuthBaseException
from social_core.storage import (
    AssociationMixin,
    BaseStorage,
    CodeMixin,
    NonceMixin,
    PartialMixin,
    UserMixin,
)
from social_core.pipeline.partial import partial_step
from social_core.strategy import BaseStrategy, BaseTemplateStrategy


RUNS: list[dict[str, Any]] = []
SENT_EMAILS: list[dict[str, Any]] = []
COMPLETES: list[dict[str, Any]] = []
DISCONNECTS: list[dict[str, Any]] = []


def reset() -> None:
    RUNS.clear()
    SENT_EMAILS.clear()
    COMPLETES.clear()
    DISCONNECTS.clear()
    for model in (User, SocialUser, Partial, Code, Nonce, Association):
        model.reset_cache()


class _BaseModel:
    NEXT_ID = 1
    cache: dict[Any, Any] = {}

    @classmethod
    def next_id(cls) -> int:
        cls.NEXT_ID += 1
        return cls.NEXT_ID - 1

    @classmethod
    def reset_cache(cls) -> None:
        cls.cache = {}


class User(_BaseModel):
    NEXT_ID = 1
    cache: dict[str, "User"] = {}

    def __init__(self, username: str, email: str | None = None, **extra) -> None:
        self.id = User.next_id()
        self.username = username
        self.email = email
        self.first_name = None
        self.password = None
        self.slug = None
        self.social = []
        self.extra_data = {}
        self.extra_user_fields = extra
        self.save()

    @property
    def is_active(self):
        return True

    @property
    def is_authenticated(self):
        return True

    def set_password(self, password) -> None:
        self.password = password

    def save(self) -> None:
        User.cache[self.username] = self

    @classmethod
    def get(cls, key):
        return cls.cache.get(key)


class SocialUser(UserMixin, _BaseModel):
    NEXT_ID = 1
    cache: dict[int, "SocialUser"] = {}
    cache_by_uid: dict[str, "SocialUser"] = {}

    def __init__(self, user, provider, uid, extra_data=None) -> None:
        self.id = SocialUser.next_id()
        self.user = user
        self.provider = provider
        self.uid = uid
        self.extra_data = extra_data or {}
        self.user.social.append(self)
        SocialUser.cache_by_uid[uid] = self

    def save(self) -> None:
        SocialUser.cache_by_uid[self.uid] = self

    @classmethod
    def reset_cache(cls) -> None:
        cls.cache = {}
        cls.cache_by_uid = {}

    @classmethod
    def changed(cls, user) -> None:
        pass

    @classmethod
    def get_username(cls, user):
        return user.username

    @classmethod
    def user_model(cls):
        return User

    @classmethod
    def username_max_length(cls) -> int:
        return 1024

    @classmethod
    def allowed_to_disconnect(cls, user, backend_name, association_id=None):
        return True

    @classmethod
    def disconnect(cls, entry) -> None:
        cls.cache.pop(entry.id, None)
        entry.user.social = [s for s in entry.user.social if entry != s]

    @classmethod
    def user_exists(cls, username):
        return User.cache.get(username) is not None

    @classmethod
    def create_user(cls, username, email=None, **extra):
        return User(username=username, email=email, **extra)

    @classmethod
    def get_user(cls, pk):
        for user in User.cache.values():
            if user.id == pk:
                return user
        return None

    @classmethod
    def get_users_by_email(cls, email):
        return [user for user in User.cache.values() if user.email == email]

    @classmethod
    def get_social_auth(cls, provider, uid):
        social = cls.cache_by_uid.get(uid)
        if social and social.provider == provider:
            return social
        return None

    @classmethod
    def get_social_auth_for_user(cls, user, provider=None, id=None):
        return [
            social
            for social in getattr(user, "social", [])
            if provider in (None, social.provider) and id in (None, social.id)
        ]

    @classmethod
    def create_social_auth(cls, user, uid, provider):
        return cls(user=user, provider=provider, uid=uid)


class Partial(PartialMixin, _BaseModel):
    NEXT_ID = 1
    cache: dict[str, "Partial"] = {}

    def save(self) -> None:
        Partial.cache[self.token] = self

    @classmethod
    def load(cls, token):
        return cls.cache.get(token)

    @classmethod
    def destroy(cls, token) -> None:
        cls.cache.pop(token, None)

    @classmethod
    def get(cls, key):
        return cls.cache.get(key)


class Code(CodeMixin, _BaseModel):
    NEXT_ID = 1
    cache: dict[str, "Code"] = {}

    def save(self) -> None:
        Code.cache[self.code] = self

    @classmethod
    def get_code(cls, code):
        for item in cls.cache.values():
            if item.code == code:
                return item
        return None

    @classmethod
    def get(cls, key):
        return cls.cache.get(key)


class Nonce(NonceMixin, _BaseModel):
    NEXT_ID = 1
    cache: dict[str, "Nonce"] = {}

    def __init__(self, server_url, timestamp, salt) -> None:
        self.id = Nonce.next_id()
        self.server_url = server_url
        self.timestamp = timestamp
        self.salt = salt

    @classmethod
    def use(cls, server_url, timestamp, salt):
        return cls(server_url, timestamp, salt)

    @classmethod
    def get(cls, server_url, salt):
        return None

    @classmethod
    def delete(cls, nonce):
        return None


class Association(AssociationMixin, _BaseModel):
    NEXT_ID = 1
    cache: dict[int, "Association"] = {}

    def __init__(self, server_url, handle, secret, issued, lifetime, assoc_type):
        self.id = Association.next_id()
        self.server_url = server_url
        self.handle = handle
        self.secret = secret
        self.issued = issued
        self.lifetime = lifetime
        self.assoc_type = assoc_type

    @classmethod
    def store(cls, server_url, association):
        cls.cache[association.id] = association

    @classmethod
    def get(cls, server_url=None, handle=None):
        return list(cls.cache.values())

    @classmethod
    def remove(cls, ids_to_delete):
        for key in ids_to_delete:
            cls.cache.pop(key, None)


class Storage(BaseStorage):
    user = SocialUser
    nonce = Nonce
    association = Association
    code = Code
    partial = Partial

    @classmethod
    def is_integrity_error(cls, exception) -> bool:
        return False


class Response:
    def __init__(self, url: str, content: str | None = None) -> None:
        self.url = url
        self.content = content


class ConfirmPage:
    """Marker returned by the optional external-resume confirmation hook."""

    def __init__(self, url: str) -> None:
        self.url = url

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"ConfirmPage({self.url!r})"


class TemplateStrategy(BaseTemplateStrategy):
    def render_template(self, tpl, context):
        return tpl

    def render_string(self, html, context):
        return html


class Strategy(BaseStrategy):
    DEFAULT_TEMPLATE_STRATEGY = TemplateStrategy

    def __init__(self, storage=Storage, tpl=None) -> None:
        self._request_data: dict[str, Any] = {}
        self._settings: dict[str, Any] = {}
        self._session: dict[str, Any] = {}
        super().__init__(storage, tpl)

    def redirect(self, url):
        return Response(url)

    def html(self, content):
        return Response("", content=content)

    def get_setting(self, name):
        return self._settings[name]

    def set_settings(self, values) -> None:
        self._settings.update(values)

    def set_request_data(self, values, backend=None) -> None:
        self._request_data.update(values)
        if backend is not None:
            backend.data = self._request_data

    def request_data(self, merge=True):
        return self._request_data

    def request_host(self):
        return "myapp.test"

    def request_is_secure(self) -> bool:
        return False

    def request_path(self) -> str:
        return ""

    def request_port(self) -> int:
        return 80

    def request_get(self):
        return self._request_data.copy()

    def request_post(self):
        return self._request_data.copy()

    def session_get(self, name, default=None):
        return self._session.get(name, default)

    def session_set(self, name, value) -> None:
        self._session[name] = value

    def session_pop(self, name):
        return self._session.pop(name, None)

    def build_absolute_uri(self, path=None):
        path = path or ""
        if path.startswith(("http://", "https://")):
            return path
        return "http://myapp.test" + path

    def authenticate(self, *args, **kwargs):
        user = super().authenticate(*args, **kwargs)
        if isinstance(user, User):
            self.session_set("username", user.username)
        return user

    # Optional compatibility with a confirmation round trip: harmless when the
    # product does not use it, and lets a confirmation-based design work too.
    def partial_pipeline_external_resume_confirmation(self, backend, partial, request_data):
        return ConfirmPage("/confirm")

    def partial_pipeline_external_resume_confirmed(self, backend, request_data):
        return "partial_pipeline_confirm" in request_data

    def send_email_validation(self, backend, email, partial_token=None):
        code = self.storage.code.make_code(email)
        SENT_EMAILS.append(
            {"email": email, "code": code.code, "token": partial_token}
        )
        return code


def make_backend(name, strategy, *, requires_email_validation=False):
    from social_core.backends.base import BaseAuth

    class _Backend(BaseAuth):
        pass

    _Backend.name = name
    _Backend.REQUIRES_EMAIL_VALIDATION = requires_email_validation

    def auth_complete(self, *args, **kwargs):
        COMPLETES.append({"backend": name, "kwargs": dict(kwargs)})
        raise AuthFailed(self, "no provider response")

    _Backend.auth_complete = auth_complete
    return _Backend(strategy, redirect_uri="/complete/" + name)


# ---------------------------------------------------------------- pipeline steps


def set_details(*args, **kwargs):
    return {"details": {"email": "user@example.test"}}


def record_run(*args, **kwargs):
    RUNS.append({"request": dict(kwargs.get("request") or {}), **kwargs})
    return {}


def record_run_marker(*args, **kwargs):
    RUNS.append(
        {
            "marker": kwargs.get("marker"),
            "request": dict(kwargs.get("request") or {}),
        }
    )
    return {}


def login_user(*args, **kwargs):
    user = User.cache.get("alice") or User(username="alice", email="user@example.test")
    backend = kwargs["backend"]
    social = SocialUser.cache_by_uid.get("uid-alice")
    if social is None:
        social = SocialUser(user, backend.name, "uid-alice")
    return {"user": user, "social": social}


def record_disconnect(*args, **kwargs):
    DISCONNECTS.append(
        {"marker": kwargs.get("flow_owner") or kwargs.get("marker"), "user": kwargs.get("user")}
    )
    return {}


# ------------------------------------------------------------------ test helpers


def new_session(settings=None):
    strategy = Strategy()
    strategy.set_settings(
        {
            "SOCIAL_AUTH_PIPELINE": (
                f"{__name__}.ask_password",
                f"{__name__}.record_run",
                f"{__name__}.login_user",
            ),
            "SOCIAL_AUTH_DISCONNECT_PIPELINE": (f"{__name__}.record_disconnect",),
            "SOCIAL_AUTH_LOGIN_REDIRECT_URL": "/ok",
            "SOCIAL_AUTH_LOGIN_ERROR_URL": "/error",
            "SOCIAL_AUTH_DISCONNECT_REDIRECT_URL": "/bye",
            "SOCIAL_AUTH_NEW_USER_REDIRECT_URL": "/new",
        }
    )
    if settings:
        strategy.set_settings(settings)
    return strategy


def new_backend(strategy, name="probe", *, requires_email_validation=False):
    return make_backend(name, strategy, requires_email_validation=requires_email_validation)


def noop_login(backend, user, social) -> None:
    backend.strategy.session_set("logged_in", user.username)


def assert_clean_refusal(case, call):
    """The request must be refused without an unclean crash.

    A library may refuse by raising its own authentication error or by returning
    a response/None instead of continuing; an internal crash is not a refusal.
    """
    try:
        return call()
    except SocialAuthBaseException as error:
        return error
    except Exception as error:  # noqa: BLE001 - a crash must be reported as a failure
        case.fail(f"refused by crashing with {type(error).__name__}: {error}")


@partial_step(save_to_session=True)
def ask_password(*args, **kwargs):
    backend = kwargs["backend"]
    data = backend.strategy.request_data()
    RUNS.append({"step": "ask_password", "request": dict(data)})
    if data.get("password"):
        return {}
    return Response("/password")
