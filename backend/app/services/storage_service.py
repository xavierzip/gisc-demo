import uuid

import boto3
from botocore.exceptions import ClientError
from flask import current_app


class StorageService:
    @staticmethod
    def _get_client():
        return boto3.client(
            "s3",
            endpoint_url=current_app.config["S3_ENDPOINT_URL"],
            aws_access_key_id=current_app.config["S3_ACCESS_KEY"],
            aws_secret_access_key=current_app.config["S3_SECRET_KEY"],
        )

    @staticmethod
    def _ensure_bucket():
        import json
        client = StorageService._get_client()
        bucket = current_app.config["S3_BUCKET"]
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError:
            client.create_bucket(Bucket=bucket)
            # Allow public read access
            policy = {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": f"arn:aws:s3:::{bucket}/*",
                }],
            }
            client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))

    @staticmethod
    def upload(file, folder="uploads"):
        """Upload a file-like object. Returns the S3 key."""
        StorageService._ensure_bucket()
        client = StorageService._get_client()
        bucket = current_app.config["S3_BUCKET"]

        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
        key = f"{folder}/{uuid.uuid4().hex}.{ext}"

        client.upload_fileobj(
            file,
            bucket,
            key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
        return key

    @staticmethod
    def get_url(key):
        """Return a URL for downloading a file via the Nginx /s3/ proxy."""
        bucket = current_app.config["S3_BUCKET"]
        return f"/s3/{bucket}/{key}"

    @staticmethod
    def delete(key):
        """Delete a file from S3."""
        client = StorageService._get_client()
        bucket = current_app.config["S3_BUCKET"]
        client.delete_object(Bucket=bucket, Key=key)
