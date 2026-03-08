import asyncio
import os
import sys

# Add current dir to path
sys.path.append(os.getcwd())

from agents.tools.stubs.literature_stub import search_pubmed

async def main():
    print("Testing PubMed Search...")
    result = await search_pubmed("Insulin", "Diabetes", limit=2)
    if result["status"] == "success":
        print(f"Success! Found {result['total_results']} papers.")
        for paper in result["results"]:
            print(f"- {paper['title']} ({paper['year']})")
    else:
        print(f"Failed: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(main())
