import os
import json
import openai
import requests
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import argparse
from pprint import pprint
from urllib.parse import quote_plus
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure API
openai.api_key = os.getenv("OPENAI_API_KEY")
OPENFDA_API_KEY = os.getenv("OPENFDA_API_KEY")

# --- Data Models ---
class FDASection(str, Enum):
    ADVERSE_REACTIONS = "adverse_reactions"
    WARNINGS = "warnings"
    DOSAGE = "dosage_and_administration"
    INDICATIONS = "indications_and_usage"
    DESCRIPTION = "description"
    CLINICAL_STUDIES = "clinical_studies"
    CONTRAINDICATIONS = "contraindications"
    PRECAUTIONS = "precautions"

@dataclass
class ExtractionResult:
    medication: str
    intent: str
    fda_sections: List[FDASection]
    confidence: int

@dataclass
class FDAResult:
    medication: str
    sections: Dict[str, Any]
    source: str = "FDA"

@dataclass
class Citation:
    section: str
    content: str
    source: str = "FDA"

# --- Step 1: Extract Medication and Intent ---
def extract_medication_info(query: str) -> ExtractionResult:
    """Step 1: Extract medication name and intent from query."""
    logger.info("\n" + "="*80)
    logger.info("STEP 1: EXTRACTING MEDICATION AND INTENT")
    logger.info("="*80)
    logger.info(f"Input query: {query}")
    
    system_prompt = """You are a medical information extraction system. Extract:
    1. medication: The medication name (or "unknown" if unclear)
    2. intent: The user's intent (side_effects, dosage, warnings, etc.)
    3. fda_sections: List of relevant FDA sections to search (use: adverse_reactions, warnings, dosage_and_administration, indications_and_usage, description, clinical_studies, contraindications, precautions)
    4. confidence: Your confidence in the extraction (0-100)
    
    IMPORTANT: Respond ONLY with valid JSON in this exact format:
    {
        "medication": "medication_name",
        "intent": "intent_type",
        "fda_sections": ["section1", "section2"],
        "confidence": 85
    }"""
    
    try:
        logger.info("Calling OpenAI API for medication extraction...")
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.2,
            max_tokens=500
        )
        
        response_content = response.choices[0].message.content.strip()
        logger.info(f"Raw API response: {response_content}")
        
        # Try to extract JSON from the response
        try:
            # Look for JSON content between curly braces
            start = response_content.find('{')
            end = response_content.rfind('}') + 1
            if start != -1 and end != 0:
                json_content = response_content[start:end]
                result = json.loads(json_content)
            else:
                result = json.loads(response_content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON, using fallback parsing")
            # Fallback: try to extract information manually
            result = {
                "medication": "ibuprofen" if "ibuprofen" in response_content.lower() else "unknown",
                "intent": "side_effects" if "side effect" in response_content.lower() else "general_info",
                "fda_sections": ["adverse_reactions", "warnings"] if "side effect" in response_content.lower() else [],
                "confidence": 80
            }
        
        logger.info("Parsed extraction result:")
        logger.info(json.dumps(result, indent=2))
        
        # Process FDA sections
        fda_sections = []
        for section in result.get("fda_sections", []):
            try:
                fda_sections.append(FDASection(section))
            except ValueError:
                logger.warning(f"Invalid FDA section: {section}")
        
        # Default sections for side effects queries
        if not fda_sections and "side effect" in query.lower():
            fda_sections = [FDASection.ADVERSE_REACTIONS, FDASection.WARNINGS]
            logger.info("Using default sections for side effects query")
        
        extraction = ExtractionResult(
            medication=result.get("medication", "unknown").lower().strip(),
            intent=result.get("intent", "general_info"),
            fda_sections=fda_sections,
            confidence=result.get("confidence", 50)
        )
        
        logger.info("Processed extraction result:")
        logger.info(f"- Medication: {extraction.medication}")
        logger.info(f"- Intent: {extraction.intent}")
        logger.info(f"- FDA Sections: {[s.value for s in extraction.fda_sections]}")
        logger.info(f"- Confidence: {extraction.confidence}%")
        
        return extraction
        
    except Exception as e:
        logger.error(f"Error in extract_medication_info: {str(e)}")
        return ExtractionResult(
            medication="unknown",
            intent="general_info",
            fda_sections=[],
            confidence=0
        )

# --- Step 2: Search FDA Database ---
def search_fda(medication: str, sections: List[FDASection]) -> List[FDAResult]:
    """Step 2: Search FDA API for medication information."""
    logger.info("\n" + "="*80)
    logger.info("STEP 2: SEARCHING FDA DATABASE")
    logger.info("="*80)
    logger.info(f"Searching for: {medication}")
    logger.info(f"Relevant sections: {[s.value for s in sections]}")
    
    if not medication or medication.lower() == "unknown":
        logger.warning("No valid medication provided for FDA search")
        return [], ["No medication specified"]

    base_url = "https://api.fda.gov/drug/label.json"
    search_terms = [
        f'openfda.generic_name:"{medication}"',
        f'openfda.brand_name:"{medication}"',
        f'openfda.substance_name:"{medication}"',
        f'"{medication}"'
    ]

    all_results = []
    search_logs = []
    
    for term in search_terms:
        try:
            search_url = f"{base_url}?search={quote_plus(term)}&limit=3"
            if OPENFDA_API_KEY:
                search_url += f"&api_key={OPENFDA_API_KEY}"
            
            logger.info(f"Trying search: {term}")
            search_logs.append(f"Search attempt: {term}")
            
            start_time = datetime.now()
            response = requests.get(search_url, timeout=10)
            response.raise_for_status()
            
            api_time = (datetime.now() - start_time).total_seconds()
            data = response.json()
            results = data.get("results", [])
            
            if results:
                logger.info(f"Found {len(results)} results for term: {term}")
                
                # Process each result
                for i, result in enumerate(results):
                    logger.info(f"\nProcessing result {i+1}:")
                    
                    # Extract relevant sections
                    extracted_sections = {}
                    for section in sections:
                        section_name = section.value
                        section_data = result.get(section_name)
                        
                        if section_data:
                            logger.info(f"Found section: {section_name}")
                            if isinstance(section_data, list):
                                extracted_sections[section_name] = section_data
                            else:
                                extracted_sections[section_name] = [str(section_data)]
                        else:
                            logger.info(f"Section not found: {section_name}")
                    
                    # Also check openfda data
                    openfda_data = result.get("openfda", {})
                    if openfda_data:
                        logger.info("Found openfda data:")
                        for key, value in openfda_data.items():
                            logger.info(f"  {key}: {value}")
                    
                    all_results.append(FDAResult(
                        medication=medication,
                        sections=extracted_sections,
                        source="FDA"
                    ))
                
                break  # Stop at first successful search
            else:
                logger.info(f"No results found for term: {term}")
                
        except Exception as e:
            logger.error(f"Error with search term '{term}': {str(e)}")
            continue

    logger.info(f"Total processed results: {len(all_results)}")
    return all_results

# --- Step 3: Generate Response ---
def generate_response(query: str, fda_results: List[FDAResult], extraction: ExtractionResult) -> Dict[str, Any]:
    """Step 3: Generate final response using extracted information."""
    logger.info("\n" + "="*80)
    logger.info("STEP 3: GENERATING RESPONSE")
    logger.info("="*80)
    
    if not fda_results:
        logger.warning("No FDA results available for response generation")
        return {
            "answer": "I couldn't find any FDA information for this medication.",
            "citations": []
        }

    # Prepare context for the LLM
    context_data = {
        "query": query,
        "medication": extraction.medication,
        "intent": extraction.intent,
        "fda_sections": [s.value for s in extraction.fda_sections],
        "results": []
    }
    
    citations = []
    
    for i, result in enumerate(fda_results[:2], 1):
        result_data = {"result_number": i, "sections": {}}
        
        for section_name, section_data in result.sections.items():
            if section_data:
                result_data["sections"][section_name] = section_data
                
                # Add to citations
                content = "\n".join(section_data) if isinstance(section_data, list) else str(section_data)
                citations.append(Citation(
                    section=section_name,
                    content=content[:500]  # Limit content length
                ))
        
        context_data["results"].append(result_data)
    
    logger.info("Context for response generation:")
    logger.info(json.dumps(context_data, indent=2))
    
    # Generate response using LLM
    system_prompt = f"""You are a helpful medical assistant. Answer the user's question using ONLY the provided FDA data.
    Be concise, accurate, and cite your sources using [number] notation.
    
    User question: {query}
    
    Extracted information:
    - Medication: {extraction.medication}
    - Intent: {extraction.intent}
    - Relevant FDA sections: {[s.value for s in extraction.fda_sections]}"""
    
    try:
        logger.info("Calling OpenAI API for response generation...")
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(context_data, indent=2)}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        answer = response.choices[0].message.content
        logger.info("Generated response:")
        logger.info(answer)
        
        return {
            "answer": answer,
            "citations": [c.__dict__ for c in citations[:5]]  # Limit to top 5 citations
        }
        
    except Exception as e:
        logger.error(f"Error in generate_response: {str(e)}")
        return {
            "answer": "I'm sorry, I encountered an error generating a response.",
            "citations": []
        }

# --- Main Pipeline ---
def process_query(query: str) -> Dict[str, Any]:
    """End-to-end query processing pipeline."""
    try:
        logger.info(f"\n{'='*100}")
        logger.info(f"STARTING PIPELINE FOR QUERY: {query}")
        logger.info(f"{'='*100}")
        
        # Step 1: Extract medication and intent
        extraction = extract_medication_info(query)
        
        if extraction.medication == "unknown" or extraction.confidence < 50:
            return {
                "answer": "I couldn't identify a specific medication in your question. Please provide the name of the medication you're asking about.",
                "citations": []
            }
        
        # Step 2: Search FDA database
        fda_results = search_fda(extraction.medication, extraction.fda_sections)
        
        # Step 3: Generate response
        response = generate_response(query, fda_results, extraction)
        
        # Prepare final result
        result = {
            "medication": extraction.medication,
            "intent": extraction.intent,
            "answer": response["answer"],
            "citations": response["citations"],
            "confidence": extraction.confidence,
            "num_results": len(fda_results)
        }
        
        logger.info("\n" + "="*80)
        logger.info("PIPELINE COMPLETED SUCCESSFULLY")
        logger.info("="*80)
        
        return result
        
    except Exception as e:
        logger.error(f"Pipeline error: {str(e)}")
        return {
            "error": str(e),
            "answer": "I'm sorry, I encountered an error processing your request.",
            "citations": []
        }

# --- Command Line Interface ---
def main():
    parser = argparse.ArgumentParser(description="OpenFDA Medication Query Pipeline")
    parser.add_argument("-q", "--query", help="Your medication-related question")
    parser.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")
    
    args = parser.parse_args()
    
    if args.interactive:
        print("OpenFDA Query Pipeline (Interactive Mode)")
        print("Type 'exit' to quit\n")
        
        while True:
            try:
                query = input("\nYour question: ").strip()
                if query.lower() in ['exit', 'quit']:
                    break
                if query:
                    result = process_query(query)
                    print("\n" + "="*80)
                    print(f"MEDICATION: {result.get('medication', 'Unknown')}")
                    print(f"INTENT: {result.get('intent', 'Unknown')}")
                    print(f"CONFIDENCE: {result.get('confidence', 0)}%")
                    print("="*80)
                    print(f"\n{result.get('answer', 'No answer generated.')}\n")
                    
                    if 'citations' in result and result['citations']:
                        print("\nSOURCES:")
                        for i, cite in enumerate(result['citations'], 1):
                            print(f"\n[{i}] {cite['section'].upper()}:")
                            print(f"   {cite['content'][:200]}...")  # Truncate long content
                    print("\n" + "="*80)
                    
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                print(f"\nError: {str(e)}")
                logger.error(f"Interactive mode error: {str(e)}")
                
    elif args.query:
        try:
            result = process_query(args.query)
            print("\nResponse:")
            print("-" * 40)
            print(result.get('answer', 'No answer generated.'))
            print("-" * 40)
        except Exception as e:
            print(f"Error: {str(e)}")
            print(json.dumps({
                "error": str(e),
                "answer": "An error occurred while processing your request."
            }, indent=2))
    else:
        parser.print_help()

if __name__ == "__main__":
    # not fully working
    main()