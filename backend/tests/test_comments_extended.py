import pytest


@pytest.fixture
def published_event(client, admin_token):
    res = client.post("/api/events", json={
        "title": "Comment Test Event",
        "start_time": "2026-06-20T09:00:00",
        "end_time": "2026-06-20T17:00:00",
        "status": "published",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    return res.get_json()


def test_unhide_comment(client, user_token, admin_token, published_event):
    # Post a comment
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Hide me"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]

    # Hide it
    client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/hide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Verify hidden
    list_res = client.get(f"/api/events/{published_event['id']}/comments")
    assert comment_id not in [c["id"] for c in list_res.get_json()]

    # Unhide it
    res = client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/unhide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["status"] == "visible"

    # Verify visible again
    list_res = client.get(f"/api/events/{published_event['id']}/comments")
    assert comment_id in [c["id"] for c in list_res.get_json()]


def test_unhide_as_user_forbidden(client, user_token, admin_token, published_event):
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Try unhide"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]

    # Hide as admin
    client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/hide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Try unhide as user
    res = client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/unhide",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403


def test_hide_nonexistent_comment(client, admin_token, published_event):
    res = client.post(
        f"/api/events/{published_event['id']}/comments/99999/hide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 404


def test_list_comments_include_hidden(client, user_token, admin_token, published_event):
    # Post and hide a comment
    comment_res = client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Secret comment"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = comment_res.get_json()["id"]
    client.post(
        f"/api/events/{published_event['id']}/comments/{comment_id}/hide",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Without include_hidden — should not see it
    res = client.get(f"/api/events/{published_event['id']}/comments")
    assert comment_id not in [c["id"] for c in res.get_json()]

    # With include_hidden — should see it
    res = client.get(f"/api/events/{published_event['id']}/comments?include_hidden=true")
    assert comment_id in [c["id"] for c in res.get_json()]


def test_comment_includes_user_name(client, user_token, published_event):
    client.post(
        f"/api/events/{published_event['id']}/comments",
        json={"body": "Named comment"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res = client.get(f"/api/events/{published_event['id']}/comments")
    comments = res.get_json()
    assert comments[0]["user_name"] == "Test User"
