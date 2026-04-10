from app import db
from datetime import datetime, timezone


class Registration(db.Model):
    __tablename__ = "registrations"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)  # references users.id, no FK
    event_id = db.Column(db.Integer, nullable=False)  # references events.id, no FK
    status = db.Column(
        db.Enum("registered", "cancelled", name="registration_status"),
        nullable=False,
        default="registered",
    )
    registered_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    cancelled_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (db.UniqueConstraint("user_id", "event_id", name="uq_user_event"),)
