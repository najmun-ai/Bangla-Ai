"""
BoroBhai S3 Presigned URL Generator Lambda

Generates presigned URLs for:
- File uploads (PUT)
- File downloads (GET)
"""

import json
import os
import boto3
from typing import Any, Dict

# PLACEHOLDER: Replace with real credentials
BEDROCK_REGION = os.environ.get('AWS_REGION', 'us-west-2')
S3_BUCKET = os.environ.get('BUCKET_NAME', 'proofsheet-user-files')

s3 = boto3.client('s3', region_name=BEDROCK_REGION)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Generate S3 presigned URL.

    Expected event format:
    {
        "key": "users/user_123/exports/cv.docx",
        "action": "get_object",  # or "put_object"
        "expires_in_seconds": 900
    }
    """

    try:
        key = event.get('key', '')
        action = event.get('action', 'get_object')
        expires_in = event.get('expires_in_seconds', 900)

        if not key:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing key parameter'})
            }

        # Validate S3 key (must start with users/)
        if not key.startswith('users/'):
            return {
                'statusCode': 403,
                'body': json.dumps({'error': 'Invalid S3 key prefix'})
            }

        # Generate presigned URL
        if action == 'put_object':
            url = s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': S3_BUCKET,
                    'Key': key,
                    'ContentType': 'application/octet-stream'
                },
                ExpiresIn=expires_in
            )
        else:  # get_object
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET, 'Key': key},
                ExpiresIn=expires_in
            )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'presigned_url': url,
                'expires_in_seconds': expires_in
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }

    except Exception as e:
        print(f"Presign error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'headers': {'Content-Type': 'application/json'}
        }
