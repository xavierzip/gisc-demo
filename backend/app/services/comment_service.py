from app import db
from app.models.comment import Comment


class CommentService:
    @staticmethod
    def validate_parent(parent_id, event_id):
        """Ensure parent comment exists and belongs to the same event."""
        if parent_id is None:
            return True
        parent = Comment.query.filter_by(id=parent_id, event_id=event_id).first()
        return parent is not None
