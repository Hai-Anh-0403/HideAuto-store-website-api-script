"""Seller device (session) management.

Covers: a login becomes a listed device → the seller signs one out → its token dies →
signing out the others → logout → a password change clears every other device.
"""

from typing import Any

import httpx

from tests.helpers import auth

EMAIL = "seller@teststore.com"
PASSWORD = "seller12345"

CHROME_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
SAFARI_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)


async def _register(client: httpx.AsyncClient) -> None:
    r = await client.post(
        "/api/v1/sellers/register",
        json={"email": EMAIL, "password": PASSWORD, "name": "Seller One"},
    )
    assert r.status_code == 201, r.text


async def _login(client: httpx.AsyncClient, user_agent: str, ip: str = "203.0.113.7") -> str:
    r = await client.post(
        "/api/v1/sellers/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={"User-Agent": user_agent, "X-Forwarded-For": f"{ip}, 10.0.0.1"},
    )
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


async def _sessions(client: httpx.AsyncClient, token: str) -> list[dict[str, Any]]:
    r = await client.get("/api/v1/sellers/me/sessions", headers=auth(token))
    assert r.status_code == 200, r.text
    items: list[dict[str, Any]] = r.json()
    return items


async def test_each_login_is_a_device_the_seller_can_see(client: httpx.AsyncClient) -> None:
    await _register(client)
    first = await _login(client, CHROME_WIN, ip="203.0.113.7")
    second = await _login(client, SAFARI_IPHONE, ip="198.51.100.3")

    rows = await _sessions(client, second)
    assert len(rows) == 2
    # Only the caller's own device is marked current.
    assert [r["current"] for r in rows].count(True) == 1
    current = next(r for r in rows if r["current"])
    assert current["device"] == "Safari · iPhone"
    # The proxied client address wins over the socket address nginx connects from.
    assert current["ip"] == "198.51.100.3"

    other = next(r for r in rows if not r["current"])
    assert other["device"] == "Chrome · Windows"
    assert other["ip"] == "203.0.113.7"

    # Both tokens still work — listing devices changes nothing.
    assert (await client.get("/api/v1/sellers/me", headers=auth(first))).status_code == 200


async def test_signing_out_a_device_kills_its_token(client: httpx.AsyncClient) -> None:
    await _register(client)
    phone = await _login(client, SAFARI_IPHONE)
    desktop = await _login(client, CHROME_WIN)

    phone_row = next(r for r in await _sessions(client, desktop) if not r["current"])
    r = await client.post(
        f"/api/v1/sellers/me/sessions/{phone_row['id']}/revoke", headers=auth(desktop)
    )
    assert r.status_code == 204, r.text

    r = await client.get("/api/v1/sellers/me", headers=auth(phone))
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "session_ended"

    rows = await _sessions(client, desktop)
    assert [r["current"] for r in rows] == [True]


async def test_revoke_others_and_logout(client: httpx.AsyncClient) -> None:
    await _register(client)
    old_one = await _login(client, CHROME_WIN)
    old_two = await _login(client, SAFARI_IPHONE)
    keep = await _login(client, CHROME_WIN)

    r = await client.post("/api/v1/sellers/me/sessions/revoke-others", headers=auth(keep))
    assert r.status_code == 200, r.text
    assert r.json()["revoked"] == 2

    for dead in (old_one, old_two):
        assert (await client.get("/api/v1/sellers/me", headers=auth(dead))).status_code == 401
    assert (await client.get("/api/v1/sellers/me", headers=auth(keep))).status_code == 200

    # Logging out ends the caller's own session too.
    assert (await client.post("/api/v1/sellers/logout", headers=auth(keep))).status_code == 204
    assert (await client.get("/api/v1/sellers/me", headers=auth(keep))).status_code == 401


async def test_another_sellers_session_cannot_be_revoked(client: httpx.AsyncClient) -> None:
    await _register(client)
    mine = await _login(client, CHROME_WIN)

    r = await client.post(
        "/api/v1/sellers/register",
        json={"email": "other@teststore.com", "password": PASSWORD, "name": "Other"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/sellers/login", json={"email": "other@teststore.com", "password": PASSWORD}
    )
    theirs = str(r.json()["access_token"])
    their_session = (await _sessions(client, theirs))[0]["id"]

    r = await client.post(f"/api/v1/sellers/me/sessions/{their_session}/revoke", headers=auth(mine))
    assert r.status_code == 404, r.text
    assert (await client.get("/api/v1/sellers/me", headers=auth(theirs))).status_code == 200


async def test_password_change_signs_out_every_other_device(client: httpx.AsyncClient) -> None:
    await _register(client)
    stolen = await _login(client, SAFARI_IPHONE)
    mine = await _login(client, CHROME_WIN)

    r = await client.post(
        "/api/v1/sellers/me/password",
        json={"current_password": PASSWORD, "new_password": "seller54321"},
        headers=auth(mine),
    )
    assert r.status_code == 200, r.text
    assert r.json()["signed_out"] == 1

    assert (await client.get("/api/v1/sellers/me", headers=auth(stolen))).status_code == 401
    # The device that changed the password stays signed in.
    assert (await client.get("/api/v1/sellers/me", headers=auth(mine))).status_code == 200
