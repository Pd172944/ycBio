# Tamarind Bio API

## Overview
Tamarind Bio provides structural biology APIs including protein structure prediction,
docking simulation, and sequence analysis.

## Auth
All requests require `Authorization: Bearer {TAMARIND_API_KEY}` header.

## Rate Limits
- Per API key rate limits apply — check your dashboard
- Use exponential backoff on 429 responses

## Endpoints Used

### Structure Prediction
```
POST {TAMARIND_API_BASE_URL}/predict/structure
Body: { "sequence": "MKTAY...", "model": "esmfold" }
Response: { "pdb_string": "...", "confidence": 0.92, "job_id": "..." }
```

### Docking Simulation
```
POST {TAMARIND_API_BASE_URL}/dock
Body: { "receptor_pdb": "...", "ligand_smiles": "..." }
Response: { "docked_pdb": "...", "binding_affinity": -8.4 }
```

### Sequence Validation
```
POST {TAMARIND_API_BASE_URL}/validate/sequence
Body: { "sequence": "MKTAY...", "format": "fasta" }
Response: { "valid": true, "length": 256, "warnings": [] }
```

## Error Handling
- `400` — invalid input (log and fail job)
- `429` — rate limited (retry with backoff)
- `500` — upstream error (retry once, then fail job)

## Output Format
Raw results are JSON and get written to Modal Volume at:
`/outputs/{job_id}/raw_result.json`
