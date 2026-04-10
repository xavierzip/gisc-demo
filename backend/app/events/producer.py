import json
import logging

from confluent_kafka import Producer
from flask import current_app

logger = logging.getLogger(__name__)


class KafkaProducer:
    _producer = None

    @classmethod
    def _get_producer(cls):
        if cls._producer is None:
            cls._producer = Producer({
                "bootstrap.servers": current_app.config["KAFKA_BOOTSTRAP_SERVERS"],
            })
        return cls._producer

    @classmethod
    def publish(cls, topic, key, value):
        try:
            producer = cls._get_producer()
            producer.produce(
                topic=topic,
                key=str(key).encode("utf-8"),
                value=json.dumps(value, default=str).encode("utf-8"),
                callback=cls._delivery_report,
            )
            producer.poll(0)  # trigger callbacks
        except Exception as e:
            logger.warning(f"Failed to publish to Kafka topic={topic}: {e}")

    @classmethod
    def flush(cls):
        if cls._producer:
            cls._producer.flush(timeout=5)

    @staticmethod
    def _delivery_report(err, msg):
        if err:
            logger.warning(f"Kafka delivery failed: {err}")
