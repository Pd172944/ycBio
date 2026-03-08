# Tamarind Bio API

## Overview
Tamarind Bio provides structural biology APIs including protein structure prediction,
docking simulation, and sequence analysis.

## Auth
All requests require `x-api-key: {TAMARIND_API_KEY}` header.

## Rate Limits
- Per API key rate limits apply — check your dashboard
- Use exponential backoff on 429 responses

## Auth Header
All requests use `x-api-key` header (not Bearer token):
```
x-api-key: {TAMARIND_API_KEY}
```

## Endpoints Used

### Submit Job (AlphaFold Structure Prediction)
```
POST {TAMARIND_API_BASE_URL}submit-job
Headers: { "x-api-key": "...", "Content-Type": "application/json" }
Body: {
  "jobName": "my-job",
  "type": "alphafold",
  "settings": {
    "sequence": "MKTAY...",
    "numModels": "5",
    "numRecycles": 3,
    "useMSA": true
  }
}
```

#### AlphaFold Settings
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sequence` * | string | — | Protein sequence (use `:` to separate chains for multimers) |
| `numModels` | string | "5" | Number of models ("1"–"5") |
| `numRecycles` | number | 3 | Recycling iterations for refinement |
| `useMSA` | boolean | true | Use Multiple Sequence Alignment |
| `pairMode` | string | — | "paired", "unpaired", or "unpaired_paired" |
| `msaDatabase` | string | "uniref" | "uniref", "swissprot", or "uniref+swissprot" |
| `templateMode` | string | "pdb100" | "pdb100", "custom", or "none" |
| `modelType` | string | "auto" | AlphaFold model variant |

## Error Handling
- `400` — invalid input (log and fail job)
- `429` — rate limited (retry with backoff)
- `500` — upstream error (retry once, then fail job)

## Output Format
Raw results are JSON and get written to Modal Volume at:
`/outputs/{job_id}/raw_result.json`
