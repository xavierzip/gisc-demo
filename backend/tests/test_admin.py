def test_dashboard_as_admin(client, admin_token):
    res = client.get("/api/admin/dashboard",
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert "events_by_status" in data
    assert "total_registrations" in data
    assert "total_comments" in data


def test_dashboard_as_user_forbidden(client, user_token):
    res = client.get("/api/admin/dashboard",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 403


def test_dashboard_unauthenticated(client):
    res = client.get("/api/admin/dashboard")
    assert res.status_code == 401
