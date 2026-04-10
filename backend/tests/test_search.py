from unittest.mock import patch, MagicMock


def _mock_es_response(items, total=None):
    if total is None:
        total = len(items)
    return {
        "hits": {
            "hits": [{"_source": item} for item in items],
            "total": {"value": total},
        }
    }


def test_search_events(client):
    mock_es = MagicMock()
    mock_es.search.return_value = _mock_es_response([
        {"id": 1, "title": "Cloud Workshop", "category": "workshop"},
    ])

    with patch("app.services.search_service.Elasticsearch", return_value=mock_es):
        res = client.get("/api/search/events?q=cloud")
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Cloud Workshop"


def test_search_events_empty(client):
    mock_es = MagicMock()
    mock_es.search.return_value = _mock_es_response([])

    with patch("app.services.search_service.Elasticsearch", return_value=mock_es):
        res = client.get("/api/search/events?q=nonexistent")
        assert res.status_code == 200
        assert res.get_json()["total"] == 0


def test_search_events_with_category(client):
    mock_es = MagicMock()
    mock_es.search.return_value = _mock_es_response([
        {"id": 1, "title": "Seminar A", "category": "seminar"},
    ])

    with patch("app.services.search_service.Elasticsearch", return_value=mock_es):
        res = client.get("/api/search/events?q=&category=seminar")
        assert res.status_code == 200
        assert res.get_json()["total"] == 1


def test_search_comments(client):
    mock_es = MagicMock()
    mock_es.search.return_value = _mock_es_response([
        {"id": 10, "body": "great event", "user_name": "Alice"},
    ])

    with patch("app.services.search_service.Elasticsearch", return_value=mock_es):
        res = client.get("/api/search/comments?q=great")
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == 1
        assert data["items"][0]["body"] == "great event"
