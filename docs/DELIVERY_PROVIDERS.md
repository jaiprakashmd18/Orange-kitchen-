# Third-party delivery integration

Orange Kitchen supports its **own riders** (Admin → Delivery team) and **third-party partners**
(Admin → Delivery partners). No partner API is active out of the box.

## Adapters
| Adapter | Behaviour |
|---|---|
| `manual` | Staff book the partner in the partner's own app, then enter the booking reference, tracking link, rider name/phone and fee on the order. Staff update the status by hand. Works with any partner, today. |
| `http_generic` | The server books deliveries and receives status webhooks using the JSON contract below. Point `api_base_url` at the partner's API if it speaks this contract, or at a small bridge service that translates it. |

To integrate a partner's native API, add an adapter in `src/lib/delivery/providers.ts` that implements
`DeliveryAdapter` (`create`, optional `quote`, `parseWebhook`), and register it in `ADAPTERS` and in the
`adapter` CHECK constraint.

## Credentials
They are never stored in the database. For a provider with env prefix `PORTER`, set these in Vercel:
`PORTER_API_KEY` and `PORTER_WEBHOOK_SECRET`. The admin page shows **"Not activated — missing …"** until
both variables and `api_base_url` are set.

## `http_generic` contract
**Create delivery**: `POST {api_base_url}/deliveries` with headers `Authorization: Bearer <API_KEY>` and `Idempotency-Key: ok-<order id>`
```json
{ "client_reference": "OK261030-1001",
  "pickup": { "name": "Orange Kitchen", "phone": "+918072272313", "address": "…", "latitude": null, "longitude": null },
  "drop": { "name": "…", "phone": "…", "address": "…", "pincode": "600066", "instructions": "…" },
  "order_value": 408, "prepaid": true }
```
Response `200`: `{ "reference": "ABC123", "tracking_url": "https://…", "fee": 45, "rider_name": "…", "rider_phone": "…" }`

**Quote** (optional): `POST {api_base_url}/quotes` with `{ "drop_pincode": "600066", "order_value": 408 }` → `{ "fee": 45 }`

**Status webhook**: `POST https://<site>/api/webhooks/delivery/<provider code>`
Header `x-signature: hex(HMAC_SHA256(raw_body, WEBHOOK_SECRET))`
```json
{ "event_id": "evt_1", "reference": "ABC123", "status": "picked_up",
  "rider_name": "…", "rider_phone": "…", "tracking_url": "https://…" }
```
`status` is one of `assigned | picked_up | out_for_delivery | delivered | cancelled | failed`. Events are
deduplicated by `event_id`, and the order advances through the stages in order.
