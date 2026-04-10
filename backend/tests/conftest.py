import pytest
from werkzeug.security import generate_password_hash

from app import create_app, db as _db
from app.config import TestConfig
from app.models.user import User


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def db(app):
    return _db


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_user(db):
    user = User(
        email="admin@test.com",
        password_hash=generate_password_hash("admin123", method="pbkdf2:sha256"),
        full_name="Test Admin",
        role="admin",
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def regular_user(db):
    user = User(
        email="user@test.com",
        password_hash=generate_password_hash("user123", method="pbkdf2:sha256"),
        full_name="Test User",
        role="user",
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def admin_token(client, admin_user):
    res = client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "admin123",
    })
    return res.get_json()["token"]


@pytest.fixture
def user_token(client, regular_user):
    res = client.post("/api/auth/login", json={
        "email": "user@test.com",
        "password": "user123",
    })
    return res.get_json()["token"]
