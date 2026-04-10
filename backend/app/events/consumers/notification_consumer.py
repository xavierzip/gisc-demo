"""Kafka consumer that dispatches notifications to users."""

import json
import logging

from confluent_kafka import Consumer, KafkaError

logger = logging.getLogger(__name__)


def run_notification_consumer(app):
    consumer = Consumer({
        "bootstrap.servers": app.config["KAFKA_BOOTSTRAP_SERVERS"],
        "group.id": "notification-consumer",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })

    topics = [
        "event.cancelled",
        "announcement.created",
        "registration.created",
    ]
    consumer.subscribe(topics)
    logger.info(f"Notification consumer subscribed to: {topics}")

    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error(f"Kafka error: {msg.error()}")
                continue

            topic = msg.topic()
            data = json.loads(msg.value().decode("utf-8"))

            with app.app_context():
                try:
                    if topic == "event.cancelled":
                        _handle_cancellation(data)
                    elif topic == "announcement.created":
                        _handle_announcement(data)
                    elif topic == "registration.created":
                        _handle_registration(data)
                except Exception as e:
                    logger.error(f"Error processing {topic}: {e}")
    finally:
        consumer.close()


def _handle_cancellation(data):
    from app.models.registration import Registration
    from app.services.notification_service import NotificationService

    event_id = data["id"]
    registrations = Registration.query.filter_by(
        event_id=event_id, status="registered"
    ).all()
    user_ids = [r.user_id for r in registrations]
    if user_ids:
        NotificationService.bulk_create(
            user_ids=user_ids,
            type="event_cancelled",
            title=f"Event cancelled: {data.get('title', '')}",
            payload={"event_id": event_id},
        )
        logger.info(f"Sent cancellation notifications to {len(user_ids)} users for event {event_id}")


def _handle_announcement(data):
    from app.models.registration import Registration
    from app.services.notification_service import NotificationService

    event_id = data["event_id"]
    registrations = Registration.query.filter_by(
        event_id=event_id, status="registered"
    ).all()
    user_ids = [r.user_id for r in registrations]
    if user_ids:
        NotificationService.bulk_create(
            user_ids=user_ids,
            type="new_announcement",
            title=data.get("title", "New announcement"),
            body=data.get("body"),
            payload={"event_id": event_id, "announcement_id": data.get("id")},
        )
        logger.info(f"Sent announcement notifications to {len(user_ids)} users for event {event_id}")


def _handle_registration(data):
    from app.services.notification_service import NotificationService

    NotificationService.create(
        user_id=data["user_id"],
        type="registration_confirmed",
        title=f"Registered for: {data.get('event_title', '')}",
        payload={"event_id": data["event_id"]},
    )
    logger.info(f"Sent registration confirmation to user {data['user_id']}")
