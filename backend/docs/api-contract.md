# Page-Proof-QA Backend API Contract (v1)

This document locks the backend API expected by the current frontend.

If these contracts change, update frontend code in `frontend/src/services/api.js`, `frontend/src/hooks/useDocumentUpload.js`, and `frontend/src/hooks/useQA.js`.

## Base Rules
- Base URL: `http://localhost:8080` (or `VITE_API_URL` in frontend)
- API style: REST JSON (except page image endpoint)
- All page numbers are 1-based.
- Evidence `bbox` must map to the page image returned by `GET /documents/{id}/pages/{page}`.
- `bbox` coordinate system: top-left origin, `x` grows right, `y` grows down.

## Endpoint Summary
- `POST /documents`
- `GET /documents/{document_id}/status`
- `GET /documents/{document_id}/pages/{page}`
- `POST /documents/{document_id}/ask`

## 1) Upload Document
`POST /documents`

### Request
- Content-Type: `multipart/form-data`
- Form field:
  - `file`: PDF binary

### Success Response
- Status: `201 Created`
- Body:
```json
{
  "document_id": "65634429-a727-427f-beb8-cf9efd327cc1"
}
```

### Error Responses
- `400 Bad Request` for non-PDF or missing file
- `413 Payload Too Large` for file over limit
- `500 Internal Server Error`

---

## 2) Poll Document Status
`GET /documents/{document_id}/status`

### Path Params
- `document_id` (string)

### Success Response
- Status: `200 OK`
- Body:
```json
{
  "status": "processing",
  "total_pages": null,
  "page_width": null,
  "page_height": null
}
```

When ready:
```json
{
  "status": "ready",
  "total_pages": 12,
  "page_width": 612,
  "page_height": 792
}
```

When failed:
```json
{
  "status": "error",
  "total_pages": null,
  "page_width": null,
  "page_height": null,
  "error_message": "Failed to extract document text"
}
```

### Contract Notes
- Allowed `status` values for frontend polling logic: `processing | ready | error`
- `total_pages`, `page_width`, `page_height` must be numbers when `status=ready`

### Error Responses
- `404 Not Found` for unknown document id
- `500 Internal Server Error`

---

## 3) Get Rendered Page Image
`GET /documents/{document_id}/pages/{page}`

### Path Params
- `document_id` (string)
- `page` (integer, 1-based)

### Success Response
- Status: `200 OK`
- Content-Type: `image/png`
- Body: raw image bytes

### Contract Notes
- Returned image must represent the same page dimensions used for evidence bbox mapping.

### Error Responses
- `404 Not Found` for unknown document/page
- `422 Unprocessable Entity` for invalid page number
- `500 Internal Server Error`

---

## 4) Ask Question
`POST /documents/{document_id}/ask`

### Path Params
- `document_id` (string)

### Request
- Content-Type: `application/json`
- Body:
```json
{
  "question": "Who signed the discharge for the patient from the post-anaesthesia care unit on April 6?"
}
```

### Success Response
- Status: `200 OK`
- Body:
```json
{
  "answer": "The discharge was signed by Kohout Jaromir MD and Williams David.",
  "evidence": [
    {
      "page": 5,
      "text": "Signed by Kohout Jaromir MD",
      "bbox": { "x1": 120.4, "y1": 515.3, "x2": 318.7, "y2": 532.8 },
      "page_width": 612.0,
      "page_height": 792.0
    },
    {
      "page": 5,
      "text": "Signed by Williams David",
      "bbox": { "x1": 121.1, "y1": 540.5, "x2": 304.2, "y2": 557.6 },
      "page_width": 612.0,
      "page_height": 792.0
    }
  ]
}
```

### Contract Notes
- `evidence` can be empty when answer is uncertain.
- Backend may return a safe fallback answer when evidence gates fail:
  `"I don't have enough grounded evidence in this document to answer that confidently."`
- Each evidence item must include:
  - `page`: integer >= 1
  - `text`: non-empty string
  - `bbox`: object with numeric `x1`, `y1`, `x2`, `y2`
- Evidence item may additionally include:
  - `page_width`: number or `null`
  - `page_height`: number or `null`
- `x2 > x1` and `y2 > y1`
- Response evidence is ordered for display by page, then top-to-bottom position.

### Error Responses
- `400 Bad Request` for empty question
- `404 Not Found` for unknown document id
- `409 Conflict` when document is not `ready`
- `500 Internal Server Error`

---

## Standard Error Envelope (Recommended)
For JSON error responses, use:

```json
{
  "detail": "Human-readable message",
  "code": "optional_machine_code"
}
```

---

## Frontend Compatibility Checklist
- Upload returns `document_id` exactly.
- Status returns `status`, `total_pages`, `page_width`, `page_height`.
- Ask returns `answer` and `evidence[]` with `page`, `text`, `bbox`.
- Page endpoint serves image bytes directly (no JSON wrapper).

---

## Versioning
Current lock: `v1`.

Any breaking change should either:
- create a `v2` endpoint set, or
- ship coordinated frontend updates in the same release.
