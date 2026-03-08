import asyncio
import os
import sys

# Add current dir to path
sys.path.append(os.getcwd())

from agents.tools.stubs.literature_stub import search_chembl

async def main():
    print("Testing ChEMBL Search...")
    result = await search_chembl("Insulin")
    if result["status"] == "success":
        print(f"Success! Found {result['total_results']} molecules.")
        for res in result["results"]:
            print(f"- {res['chembl_id']}: {res['activity_type']} = {res['activity_value']} {res['activity_unit']}")
    else:
        print(f"Failed: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(main())
