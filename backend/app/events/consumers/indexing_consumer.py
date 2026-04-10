"""Kafka consumer that indexes events/comments into Elasticsearch and invalidates caches."""

import json
import logging

from confluent_kafka import Consumer, KafkaError

logger = logging.getLogger(__name__)


def run_indexing_consumer(app):
    from app.services.search_service import SearchService

    with app.app_context():
        SearchService.ensure_indices()

    consumer = Consumer({
        "bootstrap.servers": app.config["KAFKA_BOOTSTRAP_SERVERS"],
        "group.id": "indexing-consumer",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })

    topics = [
        "event.created", "event.updated", "event.cancelled",
        "comment.created", "comment.hidden",
        "registration.created", "registration.cancelled",
    ]
    consumer.subscribe(topics)
    logger.info(f"Indexing consumer subscribed to: {topics}")

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
                    if topic in ("event.created", "event.updated", "event.cancelled"):
                        _index_event(data)
                        _invalidate_event_cache(data)
                    elif topic == "comment.created":
                        _index_comment(data)
                    elif topic == "comment.hidden":
                        _update_comment_hidden(data)
                    elif topic in ("registration.created", "registration.cancelled"):
                        _invalidate_registration_cache(data)
                except Exception as e:
                    logger.error(f"Error processing {topic}: {e}")
    finally:
        consumer.close()


def _index_event(data):
    from elasticsearch import Elasticsearch, NotFoundError
    from flask import current_app

    es = Elasticsearch(current_app.config["ELASTICSEARCH_URL"])
    # Hard-delete path: EventService.delete_event publishes a minimal
    # payload with a `deleted` flag so the index row gets removed instead
    # of overwritten with an empty document.
    if data.get("deleted"):
        try:
            es.delete(index="events", id=data["id"])
            logger.info(f"Deleted event {data['id']} from ES")
        except NotFoundError:
            pass
        return
    es.index(index="events", id=data["id"], document=data)
    logger.info(f"Indexed event {data['id']}: {data.get('title', '')}")


def _index_comment(data):
    from elasticsearch import Elasticsearch
    from flask import current_app

    es = Elasticsearch(current_app.config["ELASTICSEARCH_URL"])
    es.index(index="comments", id=data["id"], document=data)
    logger.info(f"Indexed comment {data['id']}")


def _update_comment_hidden(data):
    from elasticsearch import Elasticsearch, NotFoundError
    from flask import current_app

    es = Elasticsearch(current_app.config["ELASTICSEARCH_URL"])
    try:
        es.update(index="comments", id=data["id"], doc={"is_hidden": data["is_hidden"]})
        logger.info(f"Updated comment {data['id']} is_hidden={data['is_hidden']}")
    except NotFoundError:
        logger.warning(f"Comment {data['id']} not found in ES")


def _invalidate_event_cache(data):
    from app.services.event_service import EventService
    EventService.invalidate_caches(data["id"])
    logger.info(f"Invalidated event cache for {data['id']}")


def _invalidate_registration_cache(data):
    from app.services.registration_service import RegistrationService
    RegistrationService.invalidate_caches(data["event_id"])
    logger.info(f"Invalidated registration cache for event {data['event_id']}")
