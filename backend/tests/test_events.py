def test_create_event_as_admin(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Tech Conference",
        "description": "Annual tech conference",
        "category": "conference",
        "location": "Convention Center",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
        "capacity": 100,
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.get_json()
    assert data["title"] == "Tech Conference"
    assert data["capacity"] == 100


def test_create_event_as_user_forbidden(client, user_token):
    res = client.post("/api/events", json={
        "title": "Unauthorized Event",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
    }, headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 403


def test_create_event_unauthenticated(client):
    res = client.post("/api/events", json={
        "title": "No Auth Event",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
    })
    assert res.status_code == 401


def test_list_events(client, admin_token):
    # Create a published event first
    client.post("/api/events", json={
        "title": "Listed Event",
        "start_time": "2026-07-01T09:00:00",
        "end_time": "2026-07-01T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})

    res = client.get("/api/events")
    assert res.status_code == 200
    data = res.get_json()
    assert "items" in data
    assert "total" in data


def test_get_event(client, admin_token):
    create_res = client.post("/api/events", json={
        "title": "Detail Event",
        "start_time": "2026-08-01T09:00:00",
        "end_time": "2026-08-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = create_res.get_json()["id"]

    res = client.get(f"/api/events/{event_id}")
    assert res.status_code == 200
    assert res.get_json()["title"] == "Detail Event"


def test_get_event_not_found(client):
    res = client.get("/api/events/99999")
    assert res.status_code == 404


def test_update_event(client, admin_token):
    create_res = client.post("/api/events", json={
        "title": "Original Title",
        "start_time": "2026-09-01T09:00:00",
        "end_time": "2026-09-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = create_res.get_json()["id"]

    res = client.put(f"/api/events/{event_id}", json={
        "title": "Updated Title",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.get_json()["title"] == "Updated Title"


def test_cancel_event(client, admin_token):
    create_res = client.post("/api/events", json={
        "title": "To Cancel",
        "start_time": "2026-10-01T09:00:00",
        "end_time": "2026-10-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = create_res.get_json()["id"]

    res = client.post(f"/api/events/{event_id}/cancel",
                      headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.get_json()["status"] == "cancelled"
