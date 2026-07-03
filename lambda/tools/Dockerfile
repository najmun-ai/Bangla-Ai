# Use AWS Lambda Python runtime as base
FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for image processing
RUN yum install -y libjpeg-turbo-devel libpng-devel

# Copy requirements
COPY requirements.txt ${LAMBDA_TASK_ROOT}/

# Install Python dependencies
RUN pip install -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy handler
COPY file_tools.py ${LAMBDA_TASK_ROOT}/

# Set handler
CMD ["file_tools.lambda_handler"]
