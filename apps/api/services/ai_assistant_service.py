import asyncio
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime
from pydantic import BaseModel

import anthropic
from core.config import settings
from models.ai_models import ChatMessage

logger = logging.getLogger(__name__)


class AIAssistantService:
    """
    AI Research Assistant leveraging Claude and the existing MoE architecture.
    
    This service provides intelligent analysis of computational biology pipelines,
    research question answering, and optimization suggestions using the same
    expert agent approach as the MoE system.
    """
    
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key
        )
        self.model = "claude-3-5-sonnet-20241022"
        
        # System prompt for the research assistant
        self.system_prompt = """You are BioOS Research Assistant, an AI specialized in computational biology and drug discovery. You help researchers understand and optimize their protein folding, molecular docking, and ADMET screening pipelines.

Your capabilities:
- Analyze AlphaFold 3, ESMFold, and DiffDock results
- Interpret pLDDT scores, PAE values, and binding affinities
- Suggest pipeline optimizations and parameter tuning
- Explain complex biochemical concepts in accessible language
- Provide context-aware recommendations based on specific research goals

Communication style:
- Scientific accuracy with accessible explanations
- Cite relevant parameters and confidence metrics
- Suggest actionable next steps
- Ask clarifying questions when context is unclear

When discussing results, always consider:
- Statistical significance and confidence intervals
- Experimental validation requirements
- Computational limitations and biases
- FDA/regulatory compliance implications"""

    async def stream_chat_response(
        self, 
        message: str,
        history: List[ChatMessage],
        context: Optional[Dict[str, Any]] = None,
        user_id: str = None
    ) -> AsyncGenerator[str, None]:
        """Stream conversational responses from the AI assistant."""
        
        try:
            # Build conversation context
            messages = self._build_conversation(message, history, context)
            
            # Stream response from Claude
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=2048,
                messages=messages,
                system=self.system_prompt,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                    
        except Exception as e:
            logger.error(f"Error in stream_chat_response: {e}")
            yield f"I apologize, but I encountered an error: {str(e)}. Please try again."

    async def analyze_research_question(
        self,
        query: str,
        domains: List[str],
        context: Optional[Dict[str, Any]] = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """
        Analyze a complex research question using a MoE-style approach
        with specialized expert perspectives.
        """
        
        # Run three expert analyses in parallel (like the MoE system)
        tasks = [
            self._structural_biologist_analysis(query, domains, context),
            self._computational_chemist_analysis(query, domains, context),
            self._drug_discovery_expert_analysis(query, domains, context)
        ]
        
        analyses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Synthesize the expert opinions
        synthesis = await self._synthesize_expert_analyses(query, analyses)
        
        return {
            "structural_biology": analyses[0] if not isinstance(analyses[0], Exception) else None,
            "computational_chemistry": analyses[1] if not isinstance(analyses[1], Exception) else None,
            "drug_discovery": analyses[2] if not isinstance(analyses[2], Exception) else None,
            "synthesis": synthesis,
            "confidence_score": self._calculate_analysis_confidence(analyses),
            "generated_at": datetime.utcnow().isoformat()
        }

    async def generate_optimization_suggestions(
        self,
        context: Dict[str, Any],
        user_id: str = None
    ) -> Dict[str, Any]:
        """Generate AI-powered pipeline optimization suggestions."""
        
        optimization_prompt = f"""Analyze this computational biology pipeline run and provide specific optimization suggestions:

Pipeline Context:
{json.dumps(context, indent=2)}

Please provide:
1. Parameter optimization recommendations (e.g., pLDDT thresholds, binding site detection settings)
2. Computational efficiency improvements
3. Result quality enhancements
4. Alternative approaches to consider
5. Potential failure points to avoid

Format your response as actionable recommendations with expected impact."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1500,
                messages=[{"role": "user", "content": optimization_prompt}],
                system=self.system_prompt
            )
            
            return {
                "suggestions": response.content[0].text,
                "context_analyzed": context.get("pipeline_type", "unknown"),
                "run_status": context.get("status", "unknown")
            }
            
        except Exception as e:
            logger.error(f"Error generating optimization suggestions: {e}")
            return {"error": str(e)}

    async def search_knowledge(
        self,
        query: str,
        domains: List[str],
        limit: int = 10,
        user_id: str = None
    ) -> List[Dict[str, Any]]:
        """Search computational biology knowledge base."""
        
        knowledge_prompt = f"""As a computational biology expert, provide detailed information about: "{query}"

Focus on these domains: {', '.join(domains)}

Provide {limit} key insights covering:
- Scientific principles and mechanisms
- Computational methods and tools
- Best practices and common pitfalls
- Recent advances and trends
- Practical applications

Format as structured insights with explanations."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": knowledge_prompt}],
                system=self.system_prompt
            )
            
            # Parse response into structured knowledge items
            knowledge_text = response.content[0].text
            return self._parse_knowledge_response(knowledge_text, domains)
            
        except Exception as e:
            logger.error(f"Error in knowledge search: {e}")
            return [{"error": str(e)}]

    async def explain_results(
        self,
        context: Dict[str, Any],
        specific_question: Optional[str] = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Explain pipeline results in accessible language."""
        
        question_context = f"\n\nSpecific question: {specific_question}" if specific_question else ""
        
        explanation_prompt = f"""Explain these computational biology pipeline results in clear, accessible language:

Pipeline Results:
{json.dumps(context, indent=2)}{question_context}

Provide:
1. What the results mean scientifically
2. Quality assessment (confidence levels, reliability)
3. Biological significance and implications
4. Potential limitations or caveats
5. Suggested next steps for research

Use analogies and plain language while maintaining scientific accuracy."""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1800,
                messages=[{"role": "user", "content": explanation_prompt}],
                system=self.system_prompt
            )
            
            return {
                "explanation": response.content[0].text,
                "context_type": context.get("pipeline_type", "unknown"),
                "question_addressed": specific_question or "general_results_explanation"
            }
            
        except Exception as e:
            logger.error(f"Error explaining results: {e}")
            return {"error": str(e)}

    def _build_conversation(
        self, 
        message: str, 
        history: List[ChatMessage], 
        context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """Build conversation context for Claude."""
        
        messages = []
        
        # Add conversation history
        for msg in history[-10:]:  # Keep last 10 messages for context
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current message with context
        current_content = message
        if context:
            current_content = f"""Context (Pipeline Run):
{json.dumps(context, indent=2)}

User Question: {message}"""
        
        messages.append({
            "role": "user",
            "content": current_content
        })
        
        return messages

    async def _structural_biologist_analysis(
        self, 
        query: str, 
        domains: List[str], 
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Expert analysis from structural biology perspective."""
        
        expert_prompt = f"""As a structural biologist expert, analyze this research question: "{query}"

Focus on protein structure, folding dynamics, conformational states, and structural-function relationships. Consider AlphaFold predictions, experimental validation, and structural quality metrics.

Domains of interest: {', '.join(domains)}
Context: {json.dumps(context) if context else 'None'}"""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=800,
            messages=[{"role": "user", "content": expert_prompt}],
            system="You are a structural biology expert specializing in protein structures and computational predictions."
        )
        
        return response.content[0].text

    async def _computational_chemist_analysis(
        self, 
        query: str, 
        domains: List[str], 
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Expert analysis from computational chemistry perspective."""
        
        expert_prompt = f"""As a computational chemistry expert, analyze this research question: "{query}"

Focus on molecular interactions, binding affinities, thermodynamics, and computational methods like molecular docking and dynamics simulations.

Domains of interest: {', '.join(domains)}
Context: {json.dumps(context) if context else 'None'}"""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=800,
            messages=[{"role": "user", "content": expert_prompt}],
            system="You are a computational chemistry expert specializing in molecular interactions and drug-target binding."
        )
        
        return response.content[0].text

    async def _drug_discovery_expert_analysis(
        self, 
        query: str, 
        domains: List[str], 
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Expert analysis from drug discovery perspective."""
        
        expert_prompt = f"""As a drug discovery expert, analyze this research question: "{query}"

Focus on ADMET properties, drug-likeness, pharmacokinetics, toxicity, and therapeutic potential. Consider regulatory requirements and translational aspects.

Domains of interest: {', '.join(domains)}
Context: {json.dumps(context) if context else 'None'}"""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=800,
            messages=[{"role": "user", "content": expert_prompt}],
            system="You are a drug discovery expert specializing in ADMET analysis and pharmaceutical development."
        )
        
        return response.content[0].text

    async def _synthesize_expert_analyses(
        self, 
        query: str, 
        analyses: List[Any]
    ) -> str:
        """Synthesize multiple expert analyses into a coherent response."""
        
        valid_analyses = [a for a in analyses if not isinstance(a, Exception)]
        
        if not valid_analyses:
            return "Unable to generate expert analysis due to errors."
        
        synthesis_prompt = f"""Synthesize these expert analyses of the research question: "{query}"

Structural Biology Perspective:
{valid_analyses[0] if len(valid_analyses) > 0 else 'Not available'}

Computational Chemistry Perspective:
{valid_analyses[1] if len(valid_analyses) > 1 else 'Not available'}

Drug Discovery Perspective:
{valid_analyses[2] if len(valid_analyses) > 2 else 'Not available'}

Provide a unified analysis that integrates these perspectives into actionable insights."""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            messages=[{"role": "user", "content": synthesis_prompt}],
            system="You are a scientific synthesizer who integrates multiple expert perspectives into coherent recommendations."
        )
        
        return response.content[0].text

    def _calculate_analysis_confidence(self, analyses: List[Any]) -> float:
        """Calculate confidence score based on successful expert analyses."""
        
        successful_analyses = sum(1 for a in analyses if not isinstance(a, Exception))
        return successful_analyses / len(analyses)

    def _parse_knowledge_response(
        self, 
        knowledge_text: str, 
        domains: List[str]
    ) -> List[Dict[str, Any]]:
        """Parse knowledge response into structured items."""
        
        # Simple parsing - in production, this could be more sophisticated
        sections = knowledge_text.split('\n\n')
        knowledge_items = []
        
        for i, section in enumerate(sections[:10]):  # Limit to 10 items
            if section.strip():
                knowledge_items.append({
                    "id": i + 1,
                    "content": section.strip(),
                    "domains": domains,
                    "relevance_score": 0.9 - (i * 0.05)  # Simple relevance scoring
                })
        
        return knowledge_items