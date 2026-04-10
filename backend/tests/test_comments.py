import pytest


@pytest.fixture
def published_event(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Commentable Event",
        "start_time": "2026-06-20T09:00:00",
        "end_time": "2026-06-20T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    return res.get_json()


def test_post_comment(client, user_token, published_event):
    res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Great event!"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["body"] == "Great event!"
    assert data["parent_id"] is None


def test_reply_to_comment(client, user_token, admin_token, published_event):
    # Post a top-level comment
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Question about the event"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]

    # Admin replies
    res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Thanks for asking!", "parent_id": comment_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    assert res.get_json()["parent_id"] == comment_id


def test_list_comments(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Comment 1"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Comment 2"},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    res = client.get(f"/api/events/{published_event['id']}/comments")
    assert res.status_code == 200
    assert len(res.get_json()) == 2


def test_hide_comment_as_admin(client, user_token, admin_token, published_event):
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Inappropriate content"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]

    res = client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/hide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200

    # Hidden comment should not appear in list
    list_res = client.get(f"/api/events/{published_event['id']}/comments")
    ids = [c["id"] for c in list_res.get_json()]
    assert comment_id not in ids


def test_hide_comment_as_user_forbidden(client, user_token, published_event):
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "My comment"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]

    res = client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/hide",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403
