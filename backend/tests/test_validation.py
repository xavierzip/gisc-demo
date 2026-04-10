"""Tests for input validation and security hardening."""


def test_register_missing_fields(client):
    res = client.post("/api/auth/register", json={"email": "a@b.com"})
    assert res.status_code == 400


def test_register_invalid_email(client):
    res = client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "password123",
        "full_name": "Test",
    })
    assert res.status_code == 400
    assert "email" in res.get_json()["error"].lower()


def test_register_short_password(client):
    res = client.post("/api/auth/register", json={
        "email": "short@test.com",
        "password": "123",
        "full_name": "Test",
    })
    assert res.status_code == 400
    assert "8" in res.get_json()["error"]


def test_register_empty_body(client):
    res = client.post("/api/auth/register", data="not json",
                      content_type="application/json")
    assert res.status_code == 400


def test_login_missing_fields(client):
    res = client.post("/api/auth/login", json={"email": "a@b.com"})
    assert res.status_code == 401


def test_create_event_missing_title(client, admin_token):
    res = client.post("/api/events", json={
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 400


def test_create_event_invalid_datetime(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Bad Date",
        "start_time": "not-a-date",
        "end_time": "2026-06-01T17:00:00",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 400


def test_comment_empty_body(client, user_token, admin_token):
    # Create event
    event_res = client.post("/api/events", json={
        "title": "Comment Test",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    res = client.post(
        f"/api/events/{event_id}/comments",
        json={"body": ""},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 400


def test_comment_too_long(client, user_token, admin_token):
    event_res = client.post("/api/events", json={
        "title": "Long Comment Test",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    event_id = event_res.get_json()["id"]

    res = client.post(
        f"/api/events/{event_id}/comments",
        json={"body": "x" * 5001},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 400
    assert "5000" in res.get_json()["error"]


def test_upload_invalid_type(client, admin_token):
    import io
    from unittest.mock import patch

    with patch("app.api.uploads.StorageService"):
        res = client.post(
            "/api/uploads",
            data={"file": (io.BytesIO(b"data"), "test.exe"), "folder": "uploads"},
            content_type="multipart/form-data",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 400
        assert "not allowed" in res.get_json()["error"]


def test_upload_invalid_folder(client, admin_token):
    import io

    res = client.post(
        "/api/uploads",
        data={
            "file": (io.BytesIO(b"data"), "test.jpg"),
            "folder": "../etc",
        },
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    assert "folder" in res.get_json()["error"].lower()


def test_upload_url_path_traversal(client, admin_token):
    res = client.get(
        "/api/uploads/url?key=../../etc/passwd",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


def test_security_headers(client):
    res = client.get("/api/health")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"
