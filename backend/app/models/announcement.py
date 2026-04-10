from app import db
from datetime import datetime, timezone


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_id = db.Column(db.Integer, nullable=False)  # references events.id, no FK
    author_id = db.Column(db.Integer, nullable=False)  # references users.id, no FK
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    type = db.Column(
        db.Enum("info", "schedule_change", "venue_change", "cancellation", name="announcement_type"),
        nullable=False,
        default="info",
    )
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
