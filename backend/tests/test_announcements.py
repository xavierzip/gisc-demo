import pytest


@pytest.fixture
def published_event(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Announcement Event",
        "start_time": "2026-07-10T09:00:00",
        "end_time": "2026-07-10T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    return res.get_json()


def test_create_announcement(client, admin_token, published_event):
    res = client.post(
        f"/api/events/{published_event['id']}/announcements",
        json={
            "title": "Venue Changed",
            "body": "The event has moved to Hall B.",
            "type": "venue_change",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["title"] == "Venue Changed"
    assert data["type"] == "venue_change"


def test_create_announcement_as_user_forbidden(client, user_token, published_event):
    res = client.post(
        f"/api/events/{published_event['id']}/announcements",
        json={"title": "Hack", "body": "Not allowed"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403


def test_list_announcements(client, admin_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/announcements",
        json={"title": "First Update", "body": "Info 1"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        f"/api/events/{published_event['id']}/announcements",
        json={"title": "Second Update", "body": "Info 2"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    res = client.get(f"/api/events/{published_event['id']}/announcements")
    assert res.status_code == 200
    assert len(res.get_json()) == 2
