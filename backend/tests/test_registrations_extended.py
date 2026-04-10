import pytest


@pytest.fixture
def published_event(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Registration Status Event",
        "start_time": "2026-06-15T09:00:00",
        "end_time": "2026-06-15T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    return res.get_json()


def test_registration_status_not_registered(client, user_token, published_event):
    res = client.get(
        f"/api/events/{published_event['id']}/registration-status",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["registered"] is False


def test_registration_status_registered(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.get(
        f"/api/events/{published_event['id']}/registration-status",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["registered"] is True


def test_registration_status_after_unregister(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    client.post(
        f"/api/events/{published_event['id']}/unregister",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.get(
        f"/api/events/{published_event['id']}/registration-status",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["registered"] is False


def test_register_for_draft_event(client, user_token, admin_token):
    res = client.post("/api/events", json={
        "title": "Draft Event",
        "start_time": "2026-06-15T09:00:00",
        "end_time": "2026-06-15T17:00:00",
        "status": "draft",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = res.get_json()["id"]

    res = client.post(
        f"/api/events/{event_id}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 400
    assert "not open" in res.get_json()["error"].lower()


def test_re_register_after_cancel(client, user_token, published_event):
    # Register
    client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    # Unregister
    client.post(
        f"/api/events/{published_event['id']}/unregister",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    # Re-register
    res = client.post(
        f"/api/events/{published_event['id']}/register",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 201
    assert res.get_json()["status"] == "registered"
