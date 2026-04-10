import pytest


@pytest.fixture
def published_event(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Registrable Event",
        "start_time": "2026-06-15T09:00:00",
        "end_time": "2026-06-15T17:00:00",
        "status": "published",
        "capacity": 2,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    return res.get_json()


def test_register_for_event(client, user_token, published_event):
    res = client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 201
    assert res.get_json()["status"] == "registered"


def test_register_duplicate(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 400
    assert "Already registered" in res.get_json()["error"]


def test_register_nonexistent_event(client, user_token):
    res = client.post(
        "/api/events/99999/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 400


def test_unregister(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.post(
        f"/api/events/{published_event['id']}/unregister",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["status"] == "cancelled"


def test_list_registrations(client, user_token, admin_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.get(
        f"/api/events/{published_event['id']}/registrations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert len(res.get_json()) == 1


def test_register_at_capacity(client, admin_token, published_event):
    """Event has capacity=2. Register 2 different users, then a 3rd should fail."""
    # Register admin (user 1)
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Register a second user
    client.post("/api/auth/register", json={
        "email": "user2@test.com",
        "password": "pass1234",
        "full_name": "User Two",
    })
    login_res = client.post("/api/auth/login", json={
        "email": "user2@test.com",
        "password": "pass1234",
    })
    token2 = login_res.get_json()["token"]
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {token2}"},
    )
    # Register a third user — should fail
    client.post("/api/auth/register", json={
        "email": "user3@test.com",
        "password": "pass1234",
        "full_name": "User Three",
    })
    login_res3 = client.post("/api/auth/login", json={
        "email": "user3@test.com",
        "password": "pass1234",
    })
    token3 = login_res3.get_json()["token"]
    res = client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {token3}"},
    )
    assert res.status_code == 400
    assert "capacity" in res.get_json()["error"].lower()
