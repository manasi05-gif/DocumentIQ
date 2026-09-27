"""
Robust wrapper around the Google Gemini API using google-genai SDK.
Handles model fallbacks, rate limit retries, diverse summary templates,
document-grounded question answering, interactive quiz/flashcard generation,
and visual mind map diagram generation.
"""

import os
import time
import json
import re
from typing import List, Dict, Optional, Any
from google import genai
from dotenv import load_dotenv

# Search for .env in current directory or parent directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))

API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

# Prioritized list of models for resilience against temporary outages or 503 demand spikes
CANDIDATE_MODELS = [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-pro-latest",
]


def ask_gemini(prompt: str, system: str = "", max_retries: int = 2) -> str:
    """
    Send prompt to Gemini with automatic fallback across candidate models.
    """
    if not API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please add your key to Backend/.env file."
        )

    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    last_error = None

    for model_name in CANDIDATE_MODELS:
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=full_prompt,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                err_str = str(e)
                last_error = e
                # If unavailable (503) or rate-limited (429), try next attempt or model
                if "503" in err_str or "429" in err_str or "high demand" in err_str:
                    time.sleep(1.0 * (attempt + 1))
                    continue
                # For 404 or unsupported model, skip immediately to next model
                elif "404" in err_str or "not found" in err_str.lower():
                    break
                else:
                    time.sleep(0.5)

    raise RuntimeError(
        f"Unable to generate response from Gemini API. Last error: {last_error}"
    )


def extract_json(text: str) -> Any:
    """
    Extracts and parses JSON from Gemini's response, handling markdown fences or leading/trailing text.
    """
    text = text.strip()
    # Strip markdown code blocks if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

    # Find boundaries of array [ ... ] or object { ... }
    first_bracket = min(
        [i for i in [text.find("["), text.find("{")] if i != -1] or [-1]
    )
    last_bracket = max(
        [i for i in [text.rfind("]"), text.rfind("}")] if i != -1] or [-1]
    )

    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        text = text[first_bracket : last_bracket + 1]

    return json.loads(text)


def summarize_text(text: str, summary_type: str = "bullet") -> str:
    """
    Summarize document text based on requested format.
    Supports all academic domains (Medical, Law, Commerce, STEM, Humanities, General).
    """
    truncated_text = text[:120000]
    if len(text) > 120000:
        truncated_text += "\n\n[... Remaining content truncated for summary ...]"

    prompts = {
        "bullet": (
            "You are an expert academic and professional document analyst supporting students across all disciplines "
            "(Medical, Law, Commerce/CA, Engineering/STEM, Humanities/UPSC, and General Studies).\n"
            "Provide a well-structured summary of the document below:\n"
            "1. **Core Highlights**: 4-6 detailed bullet points capturing key facts, numbers, sections/formulas, and findings.\n"
            "2. **Executive Overview**: A crisp 2-3 sentence wrap-up.\n"
            "Format cleanly in Markdown. If the text contains mathematical, chemical, or physical formulas, format them in standard LaTeX ($...$ for inline, $$...$$ for block)."
        ),
        "executive": (
            "You are a senior academic and executive advisor. Create a high-impact Executive Summary of the document:\n"
            "- **Objective & Purpose**\n"
            "- **Strategic Findings, Data Points & Rules**\n"
            "- **Risks, Gotchas & Limitations**\n"
            "- **Bottom Line Recommendation & Key Takeaway**\n"
            "Use professional, authoritative Markdown formatting with LaTeX math delimiters ($...$) where applicable."
        ),
        "action_items": (
            "You are an academic project and study specialist. Review the document and extract:\n"
            "- **Key Action Items & Study Directives** (what must be memorized, calculated, or applied)\n"
            "- **Critical Decisions & Core Principles**\n"
            "- **Next Steps & Practical Application**\n"
            "If no explicit action items exist, synthesize actionable next study/analysis steps based on the text."
        ),
        "deep": (
            "You are an in-depth analytical researcher and university professor. Produce an exhaustive breakdown:\n"
            "- **Detailed Thematic Breakdown** by major concepts/statutes/anatomical or mathematical sections\n"
            "- **Evidence, Numerical Metrics, Formulas & Case Citations**\n"
            "- **Critical Evaluation & Synthesis**\n"
            "Use comprehensive Markdown with tables, lists, and LaTeX equations ($...$) where appropriate."
        ),
    }

    system_prompt = prompts.get(summary_type, prompts["bullet"])
    return ask_gemini(prompt=truncated_text, system=system_prompt)


def answer_question(
    context: str,
    question: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Answers a question grounded strictly in the provided document context chunks.
    Universally adaptable for students across all academic streams:
    - Medical/MBBS/NEET (Clinical signs, symptoms, pharmacology, pathophysiology)
    - Law/Judiciary (Statutory sections, case precedents, legal doctrines, remedies)
    - Commerce/CA/Finance (Accounting standards, ratios, journal entries, tax rules)
    - Engineering/STEM (Mathematical equations, algorithms, scientific laws, units)
    - Humanities/UPSC (Timelines, thinkers, cause-and-effect, social/political analysis)
    """
    system_prompt = (
        "You are an intelligent, highly versatile Academic & Document Assistant designed for students across ANY field.\n"
        "Instructions:\n"
        "1. GROUNDING: Answer the user's question using ONLY the provided Document Context excerpts below. "
        "Do not invent facts not supported by the document.\n"
        "2. INSUFFICIENT CONTEXT: If the answer cannot be determined from the context, state: "
        "'The document does not provide enough information to answer this specific question.' "
        "and mention any closely related details that ARE present in the document.\n"
        "3. DOMAIN ADAPTATION:\n"
        "   - For Medical/Biology: Emphasize clinical significance, mechanisms, contraindications, and normal values.\n"
        "   - For Law/Judiciary: Accurately cite statutory sections, articles, case laws, and legal principles.\n"
        "   - For Commerce/Finance/CA: Clearly explain accounting standards, financial formulas, debit/credit rules, and ratios.\n"
        "   - For Engineering/STEM: Explain formulas step-by-step, state variable definitions, and include code/algorithms if present.\n"
        "   - For Humanities/UPSC: Clarify chronological dates, cause-and-effect, and multidimensional perspectives.\n"
        "4. LATEX MATH & FORMULAS: Whenever writing mathematical, scientific, physical, or financial formulas, ALWAYS use standard LaTeX delimiters: inline `$formula$` or display `$$formula$$` so they render properly in KaTeX.\n"
        "5. LANGUAGE & TONE FLEXIBILITY: If the user asks in Hindi or Hinglish (e.g. 'is point ko explain karo', 'formula kya hai'), reply in natural, fluent, easy-to-understand Hinglish. If in English, reply in English.\n"
        "6. FEYNMAN TECHNIQUE / EXPLAIN SIMPLY: If the user asks to explain simply or like a beginner, use intuitive real-world analogies and breakdown complex jargon.\n"
        "7. FORMATTING: Use clean Markdown (bullet points, bold key terms, tables, callouts) for high readability."
    )

    history_str = ""
    if chat_history:
        recent = chat_history[-6:]  # Last 3 turns
        formatted_history = []
        for msg in recent:
            role_label = "User" if msg.get("role") == "user" else "Assistant"
            formatted_history.append(f"{role_label}: {msg.get('message', '')}")
        history_str = "Recent Conversation History:\n" + "\n".join(formatted_history) + "\n\n"

    prompt = (
        f"{history_str}"
        f"--- DOCUMENT CONTEXT EXCERPTS ---\n"
        f"{context}\n"
        f"--- END DOCUMENT CONTEXT ---\n\n"
        f"User Question: {question}"
    )

    return ask_gemini(prompt=prompt, system=system_prompt)


def generate_quiz(
    text: str,
    num_questions: int = 5,
    difficulty: str = "medium",
    topic: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Generates high-yield multiple choice questions (MCQs) from document text.
    Supports topic-specific filtering, adaptive difficulty, topic tagging, and improvement tips for weakness diagnosis.
    """
    truncated = text[:80000]

    topic_instruction = ""
    if topic and topic.strip() and topic.strip().lower() != "all":
        topic_instruction = f"CRITICAL: Focus all {num_questions} questions EXCLUSIVELY on the topic '{topic.strip()}' from the document.\n"

    system_prompt = (
        "You are an expert university professor and cognitive diagnostician across multiple disciplines.\n"
        f"Generate exactly {num_questions} Multiple Choice Questions (difficulty: {difficulty}) "
        "strictly based on the key concepts, facts, figures, formulas, and definitions in the provided document.\n"
        f"{topic_instruction}"
        "DOMAIN-SPECIFIC QUESTION STYLES:\n"
        "- Medical/Bio: Include clinical vignettes, symptoms, drug mechanisms, or diagnostic criteria.\n"
        "- Law: Include statutory sections, legal tests, case precedents, and constitutional provisions.\n"
        "- Commerce/Finance: Include accounting rules, ratio calculations, and taxation principles.\n"
        "- STEM/Engineering: Include derivations, algorithm logic, scientific laws, and formulas (format formulas in LaTeX $...$).\n"
        "- Humanities/UPSC: Include chronological sequences, cause-and-effect, and multidimensional perspectives.\n"
        "OUTPUT FORMAT REQUIREMENT:\n"
        "Return ONLY a valid JSON list without any markdown wrapping or conversational text.\n"
        "Every single question MUST have a specific 'topic' name (2-4 words) and an 'improvement_tip'.\n"
        "Each item in the list must adhere to this exact structure:\n"
        "[\n"
        "  {\n"
        '    "id": 1,\n'
        '    "topic": "Specific Concept or Subtopic Name",\n'
        '    "difficulty": "beginner|intermediate|advanced",\n'
        '    "question": "Question text here?",\n'
        '    "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '    "answer_index": 0,\n'
        '    "explanation": "Clear explanation of why this answer is correct according to the document.",\n'
        '    "improvement_tip": "Specific, actionable tip on what concept or rule to review if answered incorrectly."\n'
        "  }\n"
        "]"
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nGenerate {num_questions} diagnostic MCQs in JSON format."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    try:
        data = extract_json(raw)
        questions = []
        if isinstance(data, list):
            questions = data
        elif isinstance(data, dict) and "questions" in data:
            questions = data["questions"]

        # Ensure fallback defaults for topic and improvement_tip
        for idx, q in enumerate(questions):
            if "id" not in q:
                q["id"] = idx + 1
            if not q.get("topic"):
                q["topic"] = topic if topic and topic != "all" else "Core Concepts"
            if not q.get("difficulty"):
                q["difficulty"] = difficulty
            if not q.get("improvement_tip"):
                q["improvement_tip"] = f"Review the section on {q['topic']} in the document notes."

        return questions
    except Exception as e:
        print(f"Quiz JSON extraction error: {e}, raw text: {raw[:300]}")
        raise ValueError(f"Failed to parse quiz questions: {str(e)}")


def extract_document_topics(text: str) -> List[str]:
    """
    Extracts 6 to 10 distinct, high-yield conceptual topics or modules from the document.
    Enables topic-specific quizzes and user knowledge radar.
    """
    truncated = text[:45000]

    system_prompt = (
        "You are an educational syllabus architect.\n"
        "Analyze the document text and extract a clean list of 6 to 10 distinct, major conceptual topics, themes, or modules covered.\n"
        "Each topic should be clear, concise (2 to 4 words), and representative of a key area a student should master.\n"
        "Return ONLY a valid JSON list of strings, for example: [\"Topic A\", \"Topic B\", \"Topic C\"]."
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nExtract the list of key topics in JSON format."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return [str(t).strip() for t in data if str(t).strip()]
        elif isinstance(data, dict) and "topics" in data:
            return [str(t).strip() for t in data["topics"] if str(t).strip()]
        return ["Core Fundamentals", "Key Terminology & Definitions", "Practical Applications", "Advanced Principles"]
    except Exception as e:
        print(f"Topic extraction error: {e}")
        return ["Core Fundamentals", "Key Terminology & Definitions", "Practical Applications", "Advanced Principles"]


def generate_targeted_drill(
    text: str,
    topic: str,
    level: str = "beginner",
    num_questions: int = 3,
) -> List[Dict[str, Any]]:
    """
    Generates an adaptive targeted ladder drill for a specific weak topic.
    level can be 'beginner', 'intermediate', or 'advanced'.
    """
    truncated = text[:60000]

    level_guide = {
        "beginner": "BEGINNER LEVEL: Core definitions, basic syntax, foundational rules, simple recognition, and intuitive recall.",
        "intermediate": "INTERMEDIATE LEVEL: Practical scenarios, problem solving, finding output/results, and standard applications.",
        "advanced": "ADVANCED LEVEL: Edge cases, subtle exam traps, multi-step logic, performance trade-offs, and tricky conditions.",
    }
    desc = level_guide.get(level.lower(), level_guide["beginner"])

    system_prompt = (
        f"You are a master academic tutor specializing in remedial mastery learning.\n"
        f"The user has been diagnosed with a WEAKNESS in the topic: '{topic}'.\n"
        f"Generate exactly {num_questions} Multiple Choice Questions strictly targeted at the {level.upper()} level:\n"
        f"{desc}\n"
        f"Focus 100% of questions on reinforcing and mastering '{topic}'.\n"
        "OUTPUT FORMAT REQUIREMENT:\n"
        "Return ONLY a valid JSON list adhering to this exact structure:\n"
        "[\n"
        "  {\n"
        '    "id": 1,\n'
        f'    "topic": "{topic}",\n'
        f'    "difficulty": "{level}",\n'
        '    "question": "Question text here?",\n'
        '    "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '    "answer_index": 0,\n'
        '    "explanation": "Clear, encouraging explanation of why this answer is correct.",\n'
        '    "improvement_tip": "Quick memory rule or mental anchor to never forget this concept."\n'
        "  }\n"
        "]"
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nGenerate {num_questions} targeted {level} questions for topic '{topic}' in JSON format."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    try:
        data = extract_json(raw)
        questions = []
        if isinstance(data, list):
            questions = data
        elif isinstance(data, dict) and "questions" in data:
            questions = data["questions"]

        for idx, q in enumerate(questions):
            if "id" not in q:
                q["id"] = idx + 1
            q["topic"] = topic
            q["difficulty"] = level
            if not q.get("improvement_tip"):
                q["improvement_tip"] = f"Practice applying {topic} with simple examples."

        return questions
    except Exception as e:
        print(f"Targeted drill error: {e}")
        raise ValueError(f"Failed to generate targeted drill: {str(e)}")


def generate_flashcards(text: str, count: int = 8) -> List[Dict[str, Any]]:
    """
    Generates revision flashcards (front: term/concept/formula, back: definition/explanation).
    Supports all academic domains with LaTeX math delimiters.
    """
    truncated = text[:80000]

    system_prompt = (
        "You are a cognitive learning, spaced-repetition, and memory specialist.\n"
        f"Generate {count} revision flashcards covering the most critical definitions, formulas, acronyms, sections, and concepts in the document.\n"
        "If including mathematical or physical formulas, format them in standard LaTeX ($...$).\n"
        "OUTPUT FORMAT REQUIREMENT:\n"
        "Return ONLY a valid JSON list adhering to this exact structure:\n"
        "[\n"
        "  {\n"
        '    "id": 1,\n'
        '    "category": "Topic or Domain",\n'
        '    "front": "Term, Acronym, Legal Section, Formula, or Conceptual Question",\n'
        '    "back": "Clear, concise definition, calculation, or answer."\n'
        "  }\n"
        "]"
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nGenerate {count} flashcards in JSON format."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    try:
        data = extract_json(raw)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "flashcards" in data:
            return data["flashcards"]
        return []
    except Exception as e:
        print(f"Flashcards JSON extraction error: {e}, raw text: {raw[:300]}")
        raise ValueError(f"Failed to parse flashcards: {str(e)}")


def generate_mindmap(text: str) -> str:
    """
    Generates clean Mermaid.js diagram syntax representing the concept hierarchy of the document.
    Adapts structure for Medical, Law, Commerce, STEM, Humanities, and General subjects.
    """
    truncated = text[:70000]

    system_prompt = (
        "You are an expert educational visualizer and concept map architect.\n"
        "Convert the document's main concepts, key modules, subtopics, and relationships into an elegant, valid Mermaid.js diagram.\n"
        "DOMAIN-ADAPTED HIERARCHY:\n"
        "- Medical: Condition -> Symptoms/Pathology -> Diagnosis -> Pharmacology/Treatment\n"
        "- Law: Subject/Act -> Sections/Clauses -> Elements -> Precedents & Exceptions\n"
        "- Commerce: Accounting/Finance Field -> Standards -> Key Statements -> Formulas/Ratios\n"
        "- STEM: Main Theory -> Governing Laws -> Equations -> Applications & Limitations\n"
        "- Humanities: Historical Era/Theme -> Primary Causes -> Key Events -> Sociopolitical Impacts\n"
        "- General: Main Subject -> Core Pillars -> Subtopics -> Key Takeaways\n\n"
        "DESIGN RULES:\n"
        "1. Start directly with 'flowchart LR' (Horizontal Left-to-Right orientation for best readability).\n"
        "2. Do NOT use markdown code fences or backticks (do not write ```mermaid or ```).\n"
        "3. Every node MUST have an alphanumeric ID (e.g. root, n1, n2, secA) and strictly double-quoted label: root[\"Main Subject\"] --> n1[\"Key Concept\"].\n"
        "4. Keep node labels concise and clear (2 to 5 words max). Avoid punctuation or special characters inside labels.\n"
        "5. Use 2 to 4 logical subgraphs/clusters where appropriate to group related items, e.g.:\n"
        "   subgraph SubA [\"Module Name\"]\n"
        "     n1 --> n2\n"
        "   end\n"
        "6. Return ONLY the raw Mermaid diagram syntax, without introductory text or explanations."
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nGenerate Mermaid flowchart syntax."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    # Clean code fences
    clean_code = re.sub(r"^```(?:mermaid)?\s*", "", raw, flags=re.MULTILINE)
    clean_code = re.sub(r"```$", "", clean_code, flags=re.MULTILINE).strip()

    # Find the starting point of the mermaid diagram
    match = re.search(r"((?:flowchart|graph)\s+(?:LR|RL|TD|TB|BT)[\s\S]*)", clean_code, re.IGNORECASE)
    if match:
        clean_code = match.group(1).strip()
    elif not clean_code.startswith(("flowchart", "graph")):
        clean_code = "flowchart LR\n" + clean_code

    # Sanitize unquoted node labels: A[Text with (parentheses)] -> A["Text with (parentheses)"]
    def _quote_node_label(m):
        prefix = m.group(1)
        inner = m.group(2).strip()
        if (inner.startswith('"') and inner.endswith('"')) or (inner.startswith("'") and inner.endswith("'")):
            return f"{prefix}{inner}]"
        safe_inner = inner.replace('"', "'")
        return f'{prefix}"{safe_inner}"]'

    clean_code = re.sub(r'(\b[a-zA-Z0-9_]+\s*\[)([^\]\n]+)(\])', _quote_node_label, clean_code)
    return clean_code


def generate_cheatsheet(text: str, focus: str = "comprehensive") -> Dict[str, Any]:
    """
    Extracts a high-density, multi-section Cheat Sheet from the document.
    Provides domain-specialized sections for Medical, Law, Commerce, STEM, Humanities, and General subjects.
    """
    truncated = text[:80000]

    domain_focus_map = {
        "medical": "clinical symptoms, diagnostic criteria, pharmacology/drug mechanisms, contraindications, and high-yield NEET/USMLE traps",
        "law": "statutory sections, constitutional articles, landmark case law precedents/ratios, legal tests, and procedural exceptions",
        "commerce": "accounting standards (AS/Ind AS), debit/credit rules, financial ratios, taxation provisions, and formulas",
        "stem": "mathematical and physical equations (in LaTeX $...$), algorithm logic/pseudocode, units, constants, and calculation edge cases",
        "humanities": "chronological timelines, key historical dates, philosophical thinkers, theoretical perspectives, and essay thesis points",
        "commands": "all code snippets, commands, syntax templates, and practical examples",
        "formulas_definitions": "core definitions, formulas (in LaTeX $...$), rules, and mathematical or technical logic",
        "exam_cram": "high-yield exam facts, gotchas, common traps, key differences, and memory acronyms",
        "comprehensive": "all major concepts, syntax/formulas, definitions, acronyms, gotchas, and comparison tables",
    }

    focus_desc = domain_focus_map.get(focus, domain_focus_map["comprehensive"])

    system_prompt = (
        "You are an elite educational researcher, executive technical writer, and exam cheat sheet creator.\n"
        f"Create an ultra-dense, comprehensive, high-value Cheat Sheet prioritizing {focus_desc}.\n\n"
        "OUTPUT FORMAT REQUIREMENT:\n"
        "Return ONLY a valid JSON object strictly matching this structure without markdown code fences:\n"
        "{\n"
        '  "title": "Master Subject Cheat Sheet",\n'
        '  "overview": "Condensed 1-2 sentence core thesis and scope.",\n'
        '  "key_metrics": [\n'
        '    {"label": "Key Modules", "value": "4"},\n'
        '    {"label": "Essential Rules", "value": "12+"}\n'
        '  ],\n'
        '  "sections": [\n'
        '    {\n'
        '      "id": "commands",\n'
        '      "title": "Core Commands & Syntax",\n'
        '      "type": "code_cards",\n'
        '      "items": [\n'
        '        {\n'
        '          "name": "Command / Formula Title",\n'
        '          "description": "Short explanation of usage",\n'
        '          "code": "EXACT_COMMAND_OR_SYNTAX_HERE",\n'
        '          "tip": "Crucial tip or best practice"\n'
        '        }\n'
        '      ]\n'
        '    },\n'
        '    {\n'
        '      "id": "acronyms",\n'
        '      "title": "Acronyms & Essential Terminology",\n'
        '      "type": "key_value",\n'
        '      "items": [\n'
        '        {\n'
        '          "term": "Term or Acronym",\n'
        '          "definition": "Clear concise meaning and full form"\n'
        '        }\n'
        '      ]\n'
        '    },\n'
        '    {\n'
        '      "id": "matrix",\n'
        '      "title": "Quick Reference Comparison Matrix",\n'
        '      "type": "table",\n'
        '      "headers": ["Item", "Category", "Key Behavior / Limit"],\n'
        '      "rows": [\n'
        '        ["Example 1", "Type A", "Key attribute 1"],\n'
        '        ["Example 2", "Type B", "Key attribute 2"]\n'
        '      ]\n'
        '    },\n'
        '    {\n'
        '      "id": "gotchas",\n'
        '      "title": "Critical Gotchas, Traps & Differences",\n'
        '      "type": "warnings",\n'
        '      "items": [\n'
        '        {\n'
        '          "title": "Trap Title (e.g. Difference between X and Y)",\n'
        '          "detail": "Actionable explanation of why this causes errors or test failures"\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    prompt = f"--- DOCUMENT TEXT ---\n{truncated}\n--- END DOCUMENT TEXT ---\nGenerate the high-density cheat sheet JSON."
    raw = ask_gemini(prompt=prompt, system=system_prompt)

    try:
        data = extract_json(raw)
        if isinstance(data, dict) and "sections" in data:
            return data
        elif isinstance(data, list):
            return {"title": "Quick Reference Cheat Sheet", "overview": "Extracted key concepts", "sections": data}
        return {
            "title": "Document Cheat Sheet",
            "overview": "Condensed reference guide",
            "sections": []
        }
    except Exception as e:
        print(f"Cheat Sheet extraction error: {e}, raw text: {raw[:300]}")
        raise ValueError(f"Failed to generate cheat sheet: {str(e)}")
