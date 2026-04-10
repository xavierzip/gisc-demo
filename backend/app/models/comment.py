from app import db
from datetime import datetime, timezone


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_id = db.Column(db.Integer, nullable=False)  # references events.id, no FK
    user_id = db.Column(db.Integer, nullable=False)  # references users.id, no FK
    parent_id = db.Column(db.Integer, nullable=True)  # references comments.id, no FK; NULL = top-level
    body = db.Column(db.Text, nullable=False)
    is_hidden = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
