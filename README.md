## What this is

- **Node.js server (repo root)**: Simple in-memory API (no DB) with:
  - `GET /products` returns 200 random products generated at startup
  - `POST /order` creates an in-memory order
  - `GET /order/{id}` fetches an order
- **`stress/`**: Python stress client that sends many concurrent orders and records latency.

## Run the server (Docker)

From repo root:

```bash
docker build -t ft-server .
docker run --rm -p 8000:8000 ft-server
```

Optional: cap memory so OOM happens faster (tune value as you like):

```bash
docker run --rm -p 8000:8000 --memory 256m ft-server
```

## Run the server (without Docker)

```bash
npm install
npm start
```

Quick check:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/products
```

## API

### `GET /products`

Returns:

```json
[
  {"id":"...", "name":"...", "price":123.45}
]
```

### `POST /order`

Body:

```json
{
  "product_id": "some-product-id",
  "quantity": 1,
  "payload_bytes": 50000,
  "note": "optional"
}
```

- **`payload_bytes`**: if > 0, the server allocates and stores a string of this size in the order to grow memory.

### `GET /order/{id}`

Returns the stored order.

## Run the stress client

In a Python venv:

```bash
pip install -r stress/requirements.txt
python stress/stress_orders.py
```

Tune concurrency by editing `THREADS` in `stress/stress_orders.py`.

Output:

- `results.jsonl` in the current working directory (one line per request, includes latency and errors).

