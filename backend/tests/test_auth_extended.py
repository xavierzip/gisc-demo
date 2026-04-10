def test_register_always_creates_user_role(client):
    """Public registration should always create role=user, even if role=admin is passed."""
    res = client.post("/api/auth/register", json={
        "email": "sneaky@test.com",
        "password": "pass1234",
        "full_name": "Sneaky",
        "role": "admin",
    })
    assert res.status_code == 201
    # Login and check the token doesn't have admin role
    login_res = client.post("/api/auth/login", json={
        "email": "sneaky@test.com",
        "password": "pass1234",
    })
    token = login_res.get_json()["token"]
    # Try accessing admin endpoint
    admin_res = client.get("/api/admin/dashboard",
                           headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 403


def test_my_registrations_empty(client, user_token):
    res = client.get("/api/auth/me/registrations",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert res.get_json() == []


def test_my_registrations_with_events(client, user_token, admin_token):
    # Create a published event
    event_res = client.post("/api/events", json={
        "title": "My Reg Event",
        "start_time": "2026-07-01T09:00:00",
        "end_time": "2026-07-01T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    # Register
    client.post(f"/api/events/{event_id}/register",
                headers={"Authorization": f"Bearer {user_token}"})

    # Check my registrations
    res = client.get("/api/auth/me/registrations",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) == 1
    assert data[0]["title"] == "My Reg Event"
    assert "registered_at" in data[0]


def test_my_registrations_excludes_cancelled(client, user_token, admin_token):
    event_res = client.post("/api/events", json={
        "title": "Cancel Reg Event",
        "start_time": "2026-07-02T09:00:00",
        "end_time": "2026-07-02T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    client.post(f"/api/events/{event_id}/register",
                headers={"Authorization": f"Bearer {user_token}"})
    client.post(f"/api/events/{event_id}/unregister",
                headers={"Authorization": f"Bearer {user_token}"})

    res = client.get("/api/auth/me/registrations",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert len(res.get_json()) == 0
