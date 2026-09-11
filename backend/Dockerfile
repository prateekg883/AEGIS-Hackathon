FROM python:3.12-slim

WORKDIR /app

# Install PostgreSQL client tools and other necessary packages
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Command to run on start
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
