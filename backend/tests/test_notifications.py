from app.models.notification import Notification


def test_list_notifications_empty(client, user_token):
    res = client.get("/api/notifications",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert res.get_json() == []


def test_list_notifications(client, user_token, regular_user, db):
    n = Notification(
        user_id=regular_user.id,
        type="event_update",
        title="Event Updated",
        body="Start time changed",
    )
    db.session.add(n)
    db.session.commit()

    res = client.get("/api/notifications",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) == 1
    assert data[0]["title"] == "Event Updated"
    assert data[0]["is_read"] is False


def test_mark_notification_read(client, user_token, regular_user, db):
    n = Notification(
        user_id=regular_user.id,
        type="registration_confirmed",
        title="Registration Confirmed",
    )
    db.session.add(n)
    db.session.commit()

    res = client.post(f"/api/notifications/{n.id}/read",
                      headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert res.get_json()["status"] == "read"


def test_mark_notification_not_found(client, user_token):
    res = client.post("/api/notifications/99999/read",
                      headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 404
