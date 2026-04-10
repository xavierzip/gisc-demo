from unittest.mock import patch, MagicMock


def test_admin_comments_via_es(client, admin_token):
    mock_es_response = {
        "items": [
            {"id": 1, "body": "test comment", "user_name": "Alice", "event_title": "Event A",
             "event_id": 1, "user_id": 1, "is_hidden": False, "created_at": "2026-04-01T10:00:00"},
        ],
        "total": 1,
        "page": 1,
    }

    with patch("app.api.admin.SearchService") as mock_search:
        mock_search.search_comments.return_value = mock_es_response

        res = client.get("/api/admin/comments?q=test&show=all",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == 1
        assert data["items"][0]["body"] == "test comment"
        mock_search.search_comments.assert_called_once_with(q="test", show="all", page=1, per_page=50)


def test_admin_comments_filter_hidden(client, admin_token):
    with patch("app.api.admin.SearchService") as mock_search:
        mock_search.search_comments.return_value = {"items": [], "total": 0, "page": 1}

        res = client.get("/api/admin/comments?show=hidden",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        mock_search.search_comments.assert_called_once_with(q="", show="hidden", page=1, per_page=50)


def test_admin_comments_forbidden_for_user(client, user_token):
    res = client.get("/api/admin/comments",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 403
