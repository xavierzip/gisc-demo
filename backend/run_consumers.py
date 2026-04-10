"""
Run Kafka consumers in separate threads.

Usage:
    python run_consumers.py

Or via Docker:
    docker compose up consumer
"""
import logging
import threading

from app import create_app
from app.events.consumers.indexing_consumer import run_indexing_consumer
from app.events.consumers.notification_consumer import run_notification_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("consumers")


def main():
    app = create_app()

    threads = [
        threading.Thread(target=run_indexing_consumer, args=(app,), name="indexing", daemon=True),
        threading.Thread(target=run_notification_consumer, args=(app,), name="notification", daemon=True),
    ]

    for t in threads:
        logger.info(f"Starting {t.name} consumer...")
        t.start()

    logger.info("All consumers running. Press Ctrl+C to stop.")

    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
