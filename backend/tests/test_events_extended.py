import io
from unittest.mock import patch


def test_upload_cover_image(client, admin_token):
    # Create an event first
    event_res = client.post("/api/events", json={
        "title": "Cover Upload Event",
        "start_time": "2026-08-01T09:00:00",
        "end_time": "2026-08-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    with patch("app.api.events.StorageService") as mock_storage:
        mock_storage.upload.return_value = "event-covers/abc.jpg"
        mock_storage.get_url.return_value = "/s3/gisc-uploads/event-covers/abc.jpg"

        res = client.post(
            f"/api/events/{event_id}/cover",
            data={"file": (io.BytesIO(b"image data"), "cover.jpg")},
            content_type="multipart/form-data",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        assert res.get_json()["cover_image"] == "/s3/gisc-uploads/event-covers/abc.jpg"


def test_upload_cover_no_file(client, admin_token):
    event_res = client.post("/api/events", json={
        "title": "No Cover Event",
        "start_time": "2026-08-02T09:00:00",
        "end_time": "2026-08-02T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    res = client.post(
        f"/api/events/{event_id}/cover",
        data={},
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


def test_upload_cover_nonexistent_event(client, admin_token):
    with patch("app.api.events.StorageService"):
        res = client.post(
            "/api/events/99999/cover",
            data={"file": (io.BytesIO(b"data"), "cover.jpg")},
            content_type="multipart/form-data",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 404


def test_upload_cover_as_user_forbidden(client, user_token):
    res = client.post(
        "/api/events/1/cover",
        data={"file": (io.BytesIO(b"data"), "cover.jpg")},
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403


def test_list_events_all_as_admin(client, admin_token):
    # Create a draft event
    client.post("/api/events", json={
        "title": "Draft Only",
        "start_time": "2026-09-01T09:00:00",
        "end_time": "2026-09-01T17:00:00",
        "status": "draft",
    }, headers={"Authorization": f"Bearer {admin_token}"})

    # Without ?all=true — should not include draft
    res = client.get("/api/events",
                     headers={"Authorization": f"Bearer {admin_token}"})
    titles = [e["title"] for e in res.get_json()["items"]]
    assert "Draft Only" not in titles

    # With ?all=true — should include draft
    res = client.get("/api/events?all=true",
                     headers={"Authorization": f"Bearer {admin_token}"})
    titles = [e["title"] for e in res.get_json()["items"]]
    assert "Draft Only" in titles


def test_list_events_all_ignored_for_user(client, user_token, admin_token):
    client.post("/api/events", json={
        "title": "Draft Invisible",
        "start_time": "2026-09-02T09:00:00",
        "end_time": "2026-09-02T17:00:00",
        "status": "draft",
    }, headers={"Authorization": f"Bearer {admin_token}"})

    res = client.get("/api/events?all=true",
                     headers={"Authorization": f"Bearer {user_token}"})
    titles = [e["title"] for e in res.get_json()["items"]]
    assert "Draft Invisible" not in titles
