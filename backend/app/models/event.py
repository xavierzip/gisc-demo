from app import db
from datetime import datetime, timezone


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(255), nullable=True)
    location_details = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    capacity = db.Column(db.Integer, nullable=True)  # NULL = unlimited
    status = db.Column(
        db.Enum("draft", "published", "cancelled", "completed", name="event_status"),
        nullable=False,
        default="draft",
    )
    cover_image = db.Column(db.String(500), nullable=True)
    created_by = db.Column(db.Integer, nullable=False)  # references users.id, no FK
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
