import os
import json
import pika
import threading
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Meooww Python Backend")

CLOUDAMQP_URL = os.getenv("CLOUDAMQP_URL")

def process_operation(ch, method, properties, body):
    data = json.loads(body)
    print(f" [Python] Received operation: {data}")
    # Perform heavy AI/ML operation here
    ch.basic_ack(delivery_tag=method.delivery_tag)

def start_consumer():
    params = pika.URLParameters(CLOUDAMQP_URL)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue='python_ops', durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='python_ops', on_message_callback=process_operation)
    print(' [Python] Waiting for operations in python_ops queue...')
    channel.start_consuming()

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-backend"}

# Start RabbitMQ consumer in a background thread
threading.Thread(target=start_consumer, daemon=True).start()
