from app import db


class EventTag(db.Model):
    """Free-text tag attached to an event. Composite PK prevents duplicate
    (event_id, tag) pairs without needing a separate id column. No FK to
    events per repo convention — integrity is enforced in EventService.
    """

    __tablename__ = "event_tags"

    event_id = db.Column(db.Integer, primary_key=True)
    tag = db.Column(db.String(50), primary_key=True)
