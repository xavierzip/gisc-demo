from app import db
from app.models.notification import Notification


class NotificationService:
    @staticmethod
    def create(user_id, type, title, body=None, payload=None):
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            payload=payload,
        )
        db.session.add(notification)
        db.session.commit()
        return notification

    @staticmethod
    def bulk_create(user_ids, type, title, body=None, payload=None):
        notifications = [
            Notification(user_id=uid, type=type, title=title, body=body, payload=payload)
            for uid in user_ids
        ]
        db.session.add_all(notifications)
        db.session.commit()
