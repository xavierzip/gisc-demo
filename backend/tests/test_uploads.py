import io
from unittest.mock import patch, MagicMock


def test_upload_file(client, admin_token):
    with patch("app.api.uploads.StorageService") as mock_storage:
        mock_storage.upload.return_value = "uploads/test.png"
        mock_storage.get_url.return_value = "/s3/gisc-uploads/uploads/test.png"

        data = {
            "file": (io.BytesIO(b"fake image data"), "test.png"),
            "folder": "event-covers",
        }
        res = client.post(
            "/api/uploads",
            data=data,
            content_type="multipart/form-data",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 201
        json_data = res.get_json()
        assert json_data["key"] == "uploads/test.png"
        assert "url" in json_data


def test_upload_no_file(client, admin_token):
    res = client.post(
        "/api/uploads",
        data={},
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


def test_upload_unauthenticated(client):
    data = {"file": (io.BytesIO(b"data"), "test.png")}
    res = client.post("/api/uploads", data=data, content_type="multipart/form-data")
    assert res.status_code == 401


def test_get_file_url(client, admin_token):
    with patch("app.api.uploads.StorageService") as mock_storage:
        mock_storage.get_url.return_value = "/s3/gisc-uploads/uploads/abc.png"

        res = client.get(
            "/api/uploads/url?key=uploads/abc.png",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        assert res.get_json()["url"] == "/s3/gisc-uploads/uploads/abc.png"


def test_get_file_url_missing_key(client, admin_token):
    res = client.get(
        "/api/uploads/url",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
