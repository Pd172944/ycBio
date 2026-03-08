import asyncio
import random
from typing import List, Dict, Any


import httpx
from typing import List, Dict, Any
import logging
from Bio import Entrez
import os

logger = logging.getLogger(__name__)

# Configure Entrez
Entrez.email = os.environ.get("ENTREZ_EMAIL", "researcher@bioos.dev")


async def search_pubmed(target_name: str, indication: str = "", limit: int = 10) -> Dict[str, Any]:
    """Real PubMed literature search using NCBI Entrez."""
    try:
        query = f"{target_name}"
        if indication:
            query += f" AND {indication}"
        
        # 1. Search for IDs
        handle = Entrez.esearch(db="pubmed", term=query, retmax=limit)
        record = Entrez.read(handle)
        handle.close()
        
        id_list = record["IdList"]
        if not id_list:
            return {"status": "success", "results": [], "total_results": 0}
            
        # 2. Fetch details
        handle = Entrez.efetch(db="pubmed", id=",".join(id_list), rettype="medline", retmode="xml")
        records = Entrez.read(handle)
        handle.close()
        
        results = []
        for article in records.get("PubmedArticle", []):
            medline = article.get("MedlineCitation", {})
            article_data = medline.get("Article", {})
            
            pmid = str(medline.get("PMID", ""))
            title = article_data.get("ArticleTitle", "No title")
            
            # Authors
            author_list = article_data.get("AuthorList", [])
            authors = [f"{a.get('LastName', '')} {a.get('Initials', '')}" for a in author_list if isinstance(a, dict)]
            
            journal = article_data.get("Journal", {}).get("Title", "Unknown Journal")
            year = article_data.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {}).get("Year", "N/A")
            
            abstract = ""
            abstract_list = article_data.get("Abstract", {}).get("AbstractText", [])
            if abstract_list:
                abstract = " ".join(abstract_list)
                
            results.append({
                "pmid": pmid,
                "title": title,
                "authors": authors[:3],
                "journal": journal,
                "year": year,
                "abstract": abstract[:500] + "..." if len(abstract) > 500 else abstract,
                "relevance_score": 1.0 # PubMed doesn't provide this directly in efetch
            })
            
        return {
            "status": "success",
            "results": results,
            "total_results": int(record["Count"]),
            "search_terms": [target_name, indication] if indication else [target_name]
        }

    except Exception as e:
        logger.error(f"PubMed search failed: {e}")
        return {"status": "error", "error": str(e)}


async def search_chembl(target_name: str, activity_type: str = "IC50") -> Dict[str, Any]:
    """Real ChEMBL database search via REST API."""
    try:
        async with httpx.AsyncClient() as client:
            # 1. Find target ID
            target_res = await client.get(
                "https://www.ebi.ac.uk/chembl/api/data/target",
                params={"target_synonym__icontains": target_name, "format": "json"}
            )
            target_res.raise_for_status()
            targets = target_res.json().get("targets", [])
            
            if not targets:
                return {"status": "success", "results": [], "total_results": 0}
                
            target_chembl_id = targets[0]["target_chembl_id"]
            
            # 2. Find activities
            act_res = await client.get(
                "https://www.ebi.ac.uk/chembl/api/data/activity",
                params={
                    "target_chembl_id": target_chembl_id,
                    "standard_type": activity_type,
                    "format": "json",
                    "limit": 10
                }
            )
            act_res.raise_for_status()
            activities = act_res.json().get("activities", [])
            
            results = []
            for act in activities:
                results.append({
                    "chembl_id": act.get("molecule_chembl_id"),
                    "activity_value": act.get("standard_value"),
                    "activity_type": activity_type,
                    "activity_unit": act.get("standard_units"),
                    "smiles": act.get("canonical_smiles"),
                    "assay_description": act.get("assay_description")
                })
                
            return {
                "status": "success",
                "results": results,
                "total_results": len(results),
                "target_name": target_name
            }

    except Exception as e:
        logger.error(f"ChEMBL search failed: {e}")
        return {"status": "error", "error": str(e)}