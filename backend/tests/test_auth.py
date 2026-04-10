def test_register_success(client):
    res = client.post("/api/auth/register", json={
        "email": "new@test.com",
        "password": "pass1234",
        "full_name": "New User",
    })
    assert res.status_code == 201
    data = res.get_json()
    assert "token" in data
    assert "user_id" in data


def test_register_duplicate_email(client, regular_user):
    res = client.post("/api/auth/register", json={
        "email": "user@test.com",
        "password": "pass1234",
        "full_name": "Duplicate",
    })
    assert res.status_code == 409


def test_login_success(client, regular_user):
    res = client.post("/api/auth/login", json={
        "email": "user@test.com",
        "password": "user123",
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "token" in data


def test_login_wrong_password(client, regular_user):
    res = client.post("/api/auth/login", json={
        "email": "user@test.com",
        "password": "wrong",
    })
    assert res.status_code == 401


def test_login_nonexistent_user(client):
    res = client.post("/api/auth/login", json={
        "email": "nobody@test.com",
        "password": "pass1234",
    })
    assert res.status_code == 401
