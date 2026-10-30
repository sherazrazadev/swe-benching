"""Shared HTTP plumbing for the live-server checks.

Every check drives the real application through its WSGI entry point (a live
server), so the middleware stack under test is exactly the one the product
ships.  Cookies are managed by hand: an attack carries the victim's session and
any anti-forgery cookie the browser holds but never a submitted token; a
legitimate request carries the token the product's own pages render.
"""
import os
import re
import urllib.error
import urllib.parse
import urllib.request

from django.contrib.auth.models import User
from django.test import Client, LiveServerTestCase

API_KEY = os.environ.get('MOBSF_API_KEY', '')


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Case(LiveServerTestCase):
    """Live-server base class with attack and legitimate request helpers."""

    def setUp(self):
        super().setUp()
        self.username = 'csrf-tester'
        self.password = 'Passw0rd!2345'
        self.user = User.objects.create_superuser(
            self.username, 'csrf@example.com', self.password)
        client = Client()
        client.force_login(self.user)
        self.session_id = client.cookies['sessionid'].value
        self.opener = urllib.request.build_opener(_NoRedirect)
        self.csrf_cookie = None
        self.form_token = None

    # ---- transport -----------------------------------------------------
    def http(self, method, path, query=None, data=None, headers=None,
             cookies=None):
        url = self.live_server_url + path
        if query:
            url += '?' + urllib.parse.urlencode(query, doseq=True)
        body = None
        hdrs = dict(headers or {})
        if data is not None:
            body = urllib.parse.urlencode(data, doseq=True).encode()
            hdrs.setdefault(
                'Content-Type', 'application/x-www-form-urlencoded')
        if cookies:
            hdrs['Cookie'] = '; '.join(
                f'{key}={value}' for key, value in cookies.items())
        req = urllib.request.Request(
            url, data=body, headers=hdrs, method=method)
        try:
            resp = self.opener.open(req, timeout=60)
            return resp.status, resp.read(), resp.headers
        except urllib.error.HTTPError as err:
            return err.code, err.read(), err.headers

    def session_cookies(self, with_csrf=True):
        cookies = {'sessionid': self.session_id}
        if with_csrf and self.csrf_cookie:
            cookies['csrftoken'] = self.csrf_cookie
        return cookies

    def load_token(self):
        """Read the anti-forgery token a signed-in browser would hold.

        When the server sets the anti-forgery cookie, use it with the token the
        page rendered.  When it does not (the vulnerable build has no
        middleware to send the cookie), use one consistent pair, which is what
        a browser that still holds the cookie would submit.
        """
        status, body, headers = self.http(
            'GET', '/', cookies={'sessionid': self.session_id})
        if status != 200:
            status, body, headers = self.http('GET', '/login/')
        match = re.search(
            rb'name="csrfmiddlewaretoken"\s+value="([^"]+)"', body)
        rendered = match.group(1).decode() if match else None
        cookie = None
        for value in (headers.get_all('Set-Cookie') or []):
            if value.startswith('csrftoken='):
                cookie = value.split(';', 1)[0].split('=', 1)[1]
        if cookie:
            self.csrf_cookie = cookie
            self.form_token = rendered or cookie
        else:
            secret = 'a' * 32
            self.csrf_cookie = secret
            self.form_token = secret

    # ---- request kinds -------------------------------------------------
    def attack(self, method, path, query=None, data=None, headers=None):
        """A cross-site request: the browser's cookies, no submitted token."""
        if self.csrf_cookie is None:
            self.load_token()
        return self.http(
            method, path, query=query, data=data, headers=headers,
            cookies=self.session_cookies())

    def legit(self, method, path, query=None, data=None, headers=None):
        """The product's own page issuing the request with its token."""
        if self.form_token is None:
            self.load_token()
        token = self.form_token
        q = dict(query or {})
        q['csrfmiddlewaretoken'] = token
        if method in ('POST', 'PUT', 'PATCH') and data is not None:
            d = dict(data)
            d['csrfmiddlewaretoken'] = token
        elif method in ('POST', 'PUT', 'PATCH'):
            d = {'csrfmiddlewaretoken': token}
        else:
            d = data
        h = dict(headers or {})
        h['X-CSRFToken'] = token
        return self.http(
            method, path, query=q, data=d, headers=h,
            cookies=self.session_cookies(with_csrf=True))

    # ---- assertions ----------------------------------------------------
    def assertBlocked(self, status, body=b''):
        """The request is refused with a client error, not a server error."""
        self.assertGreaterEqual(
            status, 400, f'expected a client error, got {status}')
        self.assertLess(
            status, 500,
            f'expected a client error, got {status}: {body[:200]!r}')
