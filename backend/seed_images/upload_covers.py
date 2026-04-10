"""
Upload generated cover images to MinIO and update event records.
Images are resized to 800x400 and compressed as JPEG before uploading.

Usage:
    docker compose exec backend python -m seed_images.upload_covers

Or locally:
    cd backend && source venv/bin/activate
    python -m seed_images.upload_covers
"""
import os
import io
import sys

# Add parent dir to path so we can import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from PIL import Image
from app import create_app, db
from app.models.event import Event
from app.services.storage_service import StorageService

IMAGES_DIR = os.path.dirname(__file__)
TARGET_WIDTH = 800
TARGET_HEIGHT = 400
JPEG_QUALITY = 85
MAX_FILE_SIZE_KB = 200


def resize_and_compress(filepath):
    """Resize to 800x400 (crop to fit) and compress as JPEG."""
    img = Image.open(filepath).convert("RGB")

    # Crop to target aspect ratio (2:1) then resize
    target_ratio = TARGET_WIDTH / TARGET_HEIGHT
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        # Image is wider — crop sides
        new_width = int(img.height * target_ratio)
        offset = (img.width - new_width) // 2
        img = img.crop((offset, 0, offset + new_width, img.height))
    else:
        # Image is taller — crop top/bottom
        new_height = int(img.width / target_ratio)
        offset = (img.height - new_height) // 2
        img = img.crop((0, offset, img.width, offset + new_height))

    img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.LANCZOS)

    buf = io.BytesIO()
    quality = JPEG_QUALITY
    img.save(buf, format="JPEG", quality=quality, optimize=True)

    # Reduce quality if still too large
    while buf.tell() > MAX_FILE_SIZE_KB * 1024 and quality > 30:
        quality -= 10
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)

    buf.seek(0)
    size_kb = buf.getbuffer().nbytes / 1024
    print(f"    Resized to {TARGET_WIDTH}x{TARGET_HEIGHT}, {size_kb:.0f}KB (q={quality})")
    return buf


def main():
    app = create_app()
    with app.app_context():
        events = Event.query.all()
        for event in events:
            png_path = os.path.join(IMAGES_DIR, f"{event.id}.png")
            jpg_path = os.path.join(IMAGES_DIR, f"{event.id}.jpg")
            filepath = png_path if os.path.exists(png_path) else jpg_path

            if not os.path.exists(filepath):
                print(f"  SKIP '{event.title}' — no image file for id={event.id}")
                continue

            print(f"  Processing '{event.title}'...")
            buf = resize_and_compress(filepath)
            buf.filename = f"{event.id}.jpg"
            buf.content_type = "image/jpeg"
            key = StorageService.upload(buf, folder="event-covers")

            event.cover_image = key
            print(f"    Uploaded -> {key}")

        db.session.commit()
        print("Done. All cover images updated.")


if __name__ == "__main__":
    main()
