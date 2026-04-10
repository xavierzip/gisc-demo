import click
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute"],
)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

    CORS(app, origins=app.config.get("CORS_ORIGINS", ["http://localhost", "http://localhost:3000"]))

    # Security headers
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Global error handler — don't leak stack traces
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    from app.api.auth import auth_bp
    from app.api.events import events_bp
    from app.api.registrations import registrations_bp
    from app.api.announcements import announcements_bp
    from app.api.comments import comments_bp
    from app.api.notifications import notifications_bp
    from app.api.search import search_bp
    from app.api.admin import admin_bp
    from app.api.uploads import uploads_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(events_bp, url_prefix="/api/events")
    app.register_blueprint(registrations_bp, url_prefix="/api/events")
    app.register_blueprint(announcements_bp, url_prefix="/api/events")
    app.register_blueprint(comments_bp, url_prefix="/api/events")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(search_bp, url_prefix="/api/search")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(uploads_bp, url_prefix="/api/uploads")

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    @app.cli.command("init-db")
    def init_db():
        """Create all database tables."""
        import app.models  # noqa: F401 — ensure all models are loaded
        db.create_all()
        print("Database tables created.")

    @app.cli.command("create-admin")
    @click.argument("email")
    @click.argument("password")
    @click.option("--name", default="Admin", help="Full name of the admin user")
    def create_admin(email, password, name):
        """Create an admin user. Usage: flask create-admin admin@example.com password123"""
        from app.models.user import User
        from werkzeug.security import generate_password_hash

        if User.query.filter_by(email=email).first():
            print(f"User {email} already exists.")
            return
        user = User(
            email=email,
            password_hash=generate_password_hash(password, method="pbkdf2:sha256"),
            full_name=name,
            role="admin",
        )
        db.session.add(user)
        db.session.commit()
        print(f"Admin user created: {email}")

    @app.cli.command("index-es")
    def index_es():
        """Create ES indices and index all existing events and comments."""
        from app.models.event import Event
        from app.models.comment import Comment
        from app.models.user import User
        from app.services.search_service import SearchService

        SearchService.ensure_indices()

        events = Event.query.all()
        for e in events:
            SearchService.index_event(e)
        print(f"Indexed {len(events)} events.")

        comments = Comment.query.all()
        if comments:
            user_ids = list({c.user_id for c in comments})
            event_ids = list({c.event_id for c in comments})
            users = {u.id: u.full_name for u in User.query.filter(User.id.in_(user_ids)).all()}
            event_map = {e.id: e.title for e in Event.query.filter(Event.id.in_(event_ids)).all()}
            for c in comments:
                SearchService.index_comment(c, event_title=event_map.get(c.event_id, ""), user_name=users.get(c.user_id, ""))
        print(f"Indexed {len(comments)} comments.")

    @app.cli.command("seed-events")
    def seed_events():
        """Seed sample events for demo purposes."""
        from datetime import datetime, timedelta, timezone
        from app.models.event import Event
        from app.models.user import User

        admin = User.query.filter_by(role="admin").first()
        if not admin:
            print("No admin user found. Run create-admin first.")
            return

        if Event.query.count() > 0:
            print(f"Events table already has {Event.query.count()} rows. Skipping.")
            return

        now = datetime.now(timezone.utc)
        events = [
            Event(
                title="Introduction to Cloud Computing",
                description="A beginner-friendly workshop covering cloud fundamentals, IaaS vs PaaS vs SaaS, and hands-on exercises with virtual machines and containers.",
                category="workshop",
                location="Training Room A",
                location_details="Building 3, Level 2",
                start_time=now + timedelta(days=7, hours=9),
                end_time=now + timedelta(days=7, hours=12),
                capacity=30,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Kubernetes in Practice",
                description="Deep dive into Kubernetes orchestration. Topics include pods, deployments, services, ingress, and persistent volumes. Bring your laptop.",
                category="workshop",
                location="Lab 1",
                location_details="IT Centre, Ground Floor",
                start_time=now + timedelta(days=14, hours=10),
                end_time=now + timedelta(days=14, hours=17),
                capacity=20,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Annual Tech Conference 2026",
                description="Our flagship annual conference featuring keynotes from industry leaders, breakout sessions on AI, security, and infrastructure, plus networking opportunities.",
                category="conference",
                location="Grand Ballroom",
                location_details="Convention Centre, 1 Main Street",
                start_time=now + timedelta(days=30, hours=9),
                end_time=now + timedelta(days=31, hours=17),
                capacity=200,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Database Performance Tuning",
                description="Learn how to identify and fix slow queries, optimise indexes, and configure MySQL for high-throughput workloads.",
                category="seminar",
                location="Online",
                location_details="Zoom link will be sent to registered attendees",
                start_time=now + timedelta(days=10, hours=14),
                end_time=now + timedelta(days=10, hours=16),
                capacity=None,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="DevOps Meetup: CI/CD Pipelines",
                description="Monthly DevOps meetup. This month we discuss CI/CD best practices, GitOps workflows, and demo a complete pipeline from commit to production.",
                category="meetup",
                location="Cafe Lounge",
                location_details="Co-working Space, 45 Tech Park Drive",
                start_time=now + timedelta(days=5, hours=18),
                end_time=now + timedelta(days=5, hours=20),
                capacity=40,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Security Awareness Training",
                description="Mandatory security training covering phishing, password hygiene, data classification, and incident reporting procedures.",
                category="workshop",
                location="Auditorium",
                location_details="HQ Building, Level 1",
                start_time=now + timedelta(days=3, hours=10),
                end_time=now + timedelta(days=3, hours=12),
                capacity=100,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Redis & Caching Strategies",
                description="Explore caching patterns, Redis data structures, TTL strategies, and cache invalidation techniques for web applications.",
                category="seminar",
                location="Meeting Room B",
                location_details="Building 2, Level 5",
                start_time=now + timedelta(days=21, hours=13),
                end_time=now + timedelta(days=21, hours=15),
                capacity=25,
                status="published",
                created_by=admin.id,
            ),
            Event(
                title="Hackathon: Build Something Cool",
                description="48-hour hackathon! Form teams, pick a challenge, and build a working prototype. Prizes for top 3 teams. Food and drinks provided.",
                category="social",
                location="Innovation Hub",
                location_details="Startup Campus, Hall C",
                start_time=now + timedelta(days=45, hours=9),
                end_time=now + timedelta(days=47, hours=17),
                capacity=60,
                status="draft",
                created_by=admin.id,
            ),
        ]

        db.session.add_all(events)
        db.session.commit()
        print(f"Seeded {len(events)} sample events.")

    @app.cli.command("generate-covers")
    def generate_covers():
        """Generate cover images for events and upload to S3."""
        import io
        from PIL import Image, ImageDraw, ImageFont
        from app.models.event import Event
        from app.services.storage_service import StorageService

        COLORS = {
            "workshop": ("#1e40af", "#3b82f6"),
            "conference": ("#7c2d12", "#ea580c"),
            "seminar": ("#166534", "#22c55e"),
            "meetup": ("#7e22ce", "#a855f7"),
            "social": ("#be123c", "#f43f5e"),
        }

        events = Event.query.all()
        if not events:
            print("No events found. Run seed-events first.")
            return

        for event in events:
            if event.cover_image:
                print(f"  Skipping '{event.title}' (already has cover)")
                continue

            bg, accent = COLORS.get(event.category, ("#374151", "#6b7280"))

            img = Image.new("RGB", (800, 400), bg)
            draw = ImageDraw.Draw(img)

            # Accent bar
            draw.rectangle([0, 340, 800, 400], fill=accent)

            # Title text
            try:
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
            except (OSError, IOError):
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()

            # Word-wrap title
            words = event.title.split()
            lines = []
            line = ""
            for word in words:
                test = f"{line} {word}".strip()
                bbox = draw.textbbox((0, 0), test, font=font_large)
                if bbox[2] > 720:
                    lines.append(line)
                    line = word
                else:
                    line = test
            lines.append(line)

            y = 80
            for ln in lines:
                draw.text((40, y), ln, fill="white", font=font_large)
                y += 50

            # Category + location
            draw.text((40, 350), f"{event.category.upper()}  •  {event.location}", fill="white", font=font_small)

            # Upload to S3
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)

            # Create a file-like object with required attributes
            buf.filename = f"{event.id}.png"
            buf.content_type = "image/png"

            key = StorageService.upload(buf, folder="event-covers")
            event.cover_image = key
            print(f"  Generated cover for '{event.title}' -> {key}")

        db.session.commit()
        print("Done.")

    return app
