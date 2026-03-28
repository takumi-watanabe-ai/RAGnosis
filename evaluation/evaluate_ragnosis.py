#!/usr/bin/env python3
"""
RAGnosis RAGAS Evaluation Script

Evaluates the RAGnosis Edge Function using RAGAS metrics:
- Faithfulness: How grounded the answer is in the retrieved context
- Answer Relevancy: How relevant the answer is to the question
- Context Precision: Precision of retrieved context
- Context Recall: How much of the ground truth is captured in context

Usage:
    # Evaluate using golden dataset
    python evaluate_ragnosis.py

    # Limit number of samples for quick testing
    python evaluate_ragnosis.py --max_samples 10

    # Use specific LLM model for RAGAS evaluation
    python evaluate_ragnosis.py --llm_model qwen2.5:7b-instruct

    # Save detailed predictions
    python evaluate_ragnosis.py --save_predictions
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from tqdm import tqdm
import logging

# Disable RAGAS telemetry
os.environ["RAGAS_DO_NOT_TRACK"] = "true"

# Suppress logging noise
logging.getLogger('ragas').setLevel(logging.ERROR)
logging.getLogger('httpx').setLevel(logging.WARNING)

from datasets import Dataset
from ragas import evaluate
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', message='.*EmbeddingUsageEvent.*')
warnings.filterwarnings('ignore', message='.*ValidationError.*')

from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from langchain_community.chat_models import ChatOllama
from langchain_community.embeddings import FastEmbedEmbeddings
import requests

# Configuration
DEFAULT_EDGE_FUNCTION_URL = os.getenv(
    "EDGE_FUNCTION_URL",
    "http://127.0.0.1:54321/functions/v1/rag-chat"
)
DEFAULT_LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")
DEFAULT_LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b-instruct")
DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
DEFAULT_GOLDEN_DATA = "golden_data/golden_dataset.jsonl"
DEFAULT_OUTPUT_DIR = "results"
DEFAULT_TIMEOUT = 60  # seconds


class RAGnosisEvaluator:
    """Evaluator for RAGnosis Edge Function using RAGAS."""

    def __init__(
        self,
        edge_function_url: str = DEFAULT_EDGE_FUNCTION_URL,
        llm_model: str = DEFAULT_LLM_MODEL,
        llm_base_url: str = DEFAULT_LLM_BASE_URL,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """Initialize evaluator."""
        self.edge_function_url = edge_function_url
        self.llm_model = llm_model
        self.llm_base_url = llm_base_url
        self.embedding_model = embedding_model
        self.timeout = timeout

        print(f"🎯 RAGnosis Evaluator")
        print(f"🌐 Edge Function: {self.edge_function_url}")
        print(f"🤖 LLM: {self.llm_model} @ {self.llm_base_url}")
        print(f"📦 Embeddings: {self.embedding_model}")
        print(f"⏱️  Timeout: {self.timeout}s")

        # Initialize RAGAS models
        print("\n📊 Initializing RAGAS evaluator...")
        self._setup_ragas_models()

    def _setup_ragas_models(self):
        """Setup LLM and embedding models for RAGAS evaluation."""
        # LLM for RAGAS metrics (using local Ollama)
        self.ragas_llm = ChatOllama(
            model=self.llm_model,
            base_url=self.llm_base_url,
            temperature=0.1,
            timeout=300,  # 5 minutes for RAGAS evaluation
            num_ctx=8192,
            num_predict=2048,
            repeat_penalty=1.1,
            top_p=0.9,
            top_k=40,
        )

        # FastEmbed wrapper with model name for telemetry
        from langchain_core.embeddings import Embeddings

        base_embeddings = FastEmbedEmbeddings(
            model_name=self.embedding_model,
            cache_dir=os.getenv("FASTEMBED_CACHE_PATH", None),
        )

        class SafeFastEmbeddings(Embeddings):
            def __init__(self, base_model, model_name):
                self._base = base_model
                self.model = model_name

            def embed_documents(self, texts):
                return self._base.embed_documents(texts)

            def embed_query(self, text):
                return self._base.embed_query(text)

        self.ragas_embeddings = SafeFastEmbeddings(base_embeddings, self.embedding_model)
        print(f"✅ RAGAS models initialized")

    def load_golden_dataset(
        self,
        filepath: str = DEFAULT_GOLDEN_DATA,
        max_samples: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Load golden dataset from JSONL file with range support."""
        questions = []

        with open(filepath, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                # Skip offset items
                if idx < offset:
                    continue

                data = json.loads(line)
                questions.append(data)

                # Check max_samples after offset
                if max_samples and len(questions) >= max_samples:
                    break

        range_str = f" [questions {offset+1}-{offset+len(questions)}]" if offset > 0 or max_samples else ""
        print(f"\n📂 Loaded {len(questions)} questions from golden dataset{range_str}")
        return questions

    def call_edge_function(self, query: str, top_k: int = 5) -> Dict[str, Any]:
        """Call RAGnosis Edge Function."""
        try:
            response = requests.post(
                self.edge_function_url,
                json={"query": query, "top_k": top_k},
                headers={"Content-Type": "application/json"},
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            return {
                "answer": "Request timed out",
                "sources": [],
                "error": "timeout"
            }
        except Exception as e:
            return {
                "answer": f"Error: {str(e)}",
                "sources": [],
                "error": str(e)
            }

    def evaluate_dataset(
        self,
        questions: List[Dict[str, Any]],
        top_k: int = 5,
        save_predictions: bool = False,
        output_dir: str = DEFAULT_OUTPUT_DIR,
    ) -> Dict[str, Any]:
        """Evaluate RAGnosis on golden dataset using RAGAS."""
        print(f"\n🔍 Running RAGnosis on {len(questions)} questions...")

        predictions = []
        route_accuracy = []
        source_count_accuracy = []
        unanswerable_count = []  # NEW: Track "I don't know" responses

        for q in tqdm(questions, desc="Generating answers"):
            result = self.call_edge_function(q["question"], top_k=top_k)

            # Extract contexts from sources
            contexts = []
            if "sources" in result and result["sources"]:
                for source in result["sources"]:
                    if "content" in source:
                        contexts.append(source["content"])
                    elif "text" in source:
                        contexts.append(source["text"])

            # If no contexts but we have an answer, use answer as context
            # This handles SQL queries which may not have "sources" with content
            if not contexts and result.get("answer"):
                contexts = [result["answer"]]

            answer = result.get("answer", "")

            # NEW: Detect "I don't have enough information" responses (CRITICAL FAILURE)
            is_unanswerable = any(phrase in answer.lower() for phrase in [
                "i don't have enough information",
                "i don't have sufficient information",
                "i cannot provide information",
                "no relevant sources found",
                "the provided sources do not",
                "i do not have information",
                "unable to answer",
                "cannot answer this question"
            ])

            prediction = {
                "question_id": q["question_id"],
                "question": q["question"],
                "ground_truth": q["ground_truth"],
                "answer": answer,
                "contexts": contexts,
                "sources": result.get("sources", []),
                "num_sources": len(result.get("sources", [])),
                "query_type": q.get("query_type", "unknown"),
                "expected_route": q.get("expected_route", "unknown"),
                "has_error": "error" in result,
                "is_unanswerable": is_unanswerable,  # NEW: Flag as critical failure
            }

            # Track unanswerable responses
            unanswerable_count.append(1 if is_unanswerable else 0)

            # Check route accuracy if available
            if "route" in result:
                prediction["actual_route"] = result["route"]
                if result["route"] == q.get("expected_route"):
                    route_accuracy.append(1)
                else:
                    route_accuracy.append(0)

            # Check source count accuracy
            expected_sources = q.get("expected_sources")
            expected_sources_min = q.get("expected_sources_min")
            if expected_sources is not None:
                if prediction["num_sources"] == expected_sources:
                    source_count_accuracy.append(1)
                else:
                    source_count_accuracy.append(0)
            elif expected_sources_min is not None:
                if prediction["num_sources"] >= expected_sources_min:
                    source_count_accuracy.append(1)
                else:
                    source_count_accuracy.append(0)

            predictions.append(prediction)

        # Save predictions if requested
        predictions_file = None
        if save_predictions:
            predictions_file = self._save_predictions(predictions, output_dir)

        # Calculate custom metrics
        custom_metrics = {
            "total_questions": len(questions),
            "error_rate": sum(1 for p in predictions if p["has_error"]) / len(predictions),
            "unanswerable_rate": sum(unanswerable_count) / len(unanswerable_count),  # NEW: CRITICAL METRIC
            "unanswerable_count": sum(unanswerable_count),  # Absolute count
        }

        if route_accuracy:
            custom_metrics["route_accuracy"] = sum(route_accuracy) / len(route_accuracy)

        if source_count_accuracy:
            custom_metrics["source_count_accuracy"] = sum(source_count_accuracy) / len(source_count_accuracy)

        # Prepare data for RAGAS evaluation
        # Filter out predictions with no contexts (errors, out-of-scope)
        valid_predictions = [p for p in predictions if p["contexts"]]

        if not valid_predictions:
            print("\n⚠️  No valid predictions with contexts for RAGAS evaluation")
            return {
                "edge_function_url": self.edge_function_url,
                "llm_model": self.llm_model,
                "custom_metrics": custom_metrics,
                "ragas_metrics": {},
                "predictions": predictions,
                "predictions_file": predictions_file,
            }

        print(f"\n📊 Evaluating {len(valid_predictions)} predictions with RAGAS...")
        ragas_data = {
            "question": [p["question"] for p in valid_predictions],
            "answer": [p["answer"] for p in valid_predictions],
            "contexts": [p["contexts"] for p in valid_predictions],
            "ground_truth": [p["ground_truth"] for p in valid_predictions],
        }

        dataset = Dataset.from_dict(ragas_data)

        # Run RAGAS evaluation
        try:
            from ragas.run_config import RunConfig

            run_config = RunConfig(
                max_workers=4,
                max_wait=180,
                timeout=180,
                max_retries=5,
            )

            print("🔧 RAGAS Configuration:")
            print("   - Parallel processing (max_workers=4)")
            print("   - 5 retries for parsing errors")
            print("   - 3 minute timeout per evaluation")

            ragas_result = evaluate(
                dataset,
                metrics=[
                    faithfulness,
                    answer_relevancy,
                    context_precision,
                    context_recall,
                ],
                llm=self.ragas_llm,
                embeddings=self.ragas_embeddings,
                run_config=run_config,
            )

            # Convert to dictionary
            df = ragas_result.to_pandas()
            ragas_metrics = df.select_dtypes(include=['number']).mean().to_dict()

            return {
                "edge_function_url": self.edge_function_url,
                "llm_model": self.llm_model,
                "embedding_model": self.embedding_model,
                "custom_metrics": custom_metrics,
                "ragas_metrics": ragas_metrics,
                "predictions": predictions,
                "predictions_file": predictions_file,
            }

        except Exception as e:
            print(f"❌ RAGAS evaluation failed: {e}")
            return {
                "edge_function_url": self.edge_function_url,
                "llm_model": self.llm_model,
                "embedding_model": self.embedding_model,
                "custom_metrics": custom_metrics,
                "ragas_metrics": {},
                "predictions": predictions,
                "predictions_file": predictions_file,
                "ragas_error": str(e),
            }

    def _save_predictions(
        self, predictions: List[Dict[str, Any]], output_dir: str
    ) -> str:
        """Save predictions to JSON file."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        filename = output_path / f"predictions_{timestamp}.json"

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(predictions, f, indent=2, ensure_ascii=False)

        print(f"💾 Predictions saved to: {filename}")
        return str(filename)


def print_results(results: Dict[str, Any]):
    """Print evaluation results."""
    print("\n" + "=" * 70)
    print("🎯 RAGnosis Evaluation Results")
    print("=" * 70)

    print(f"\n📋 Configuration:")
    print(f"  Edge Function:   {results['edge_function_url']}")
    print(f"  LLM Model:       {results['llm_model']}")
    print(f"  Embedding Model: {results.get('embedding_model', 'N/A')}")

    print(f"\n📊 Custom Metrics:")
    for metric_name, value in results["custom_metrics"].items():
        if isinstance(value, float):
            print(f"  {metric_name:25s}: {value:.4f}")
        else:
            print(f"  {metric_name:25s}: {value}")

    if results["ragas_metrics"]:
        print(f"\n📊 RAGAS Metrics:")
        for metric_name, value in results["ragas_metrics"].items():
            print(f"  {metric_name:25s}: {value:.4f}")
    elif "ragas_error" in results:
        print(f"\n❌ RAGAS Error: {results['ragas_error']}")
    else:
        print("\n⚠️  No RAGAS metrics available")

    if results.get("predictions_file"):
        print(f"\n💾 Predictions: {results['predictions_file']}")

    print("=" * 70 + "\n")


def save_results(results: Dict[str, Any], output_dir: str):
    """Save evaluation results to JSON file."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_path / f"evaluation_results_{timestamp}.json"

    # Remove predictions from saved results (too large)
    results_to_save = results.copy()
    results_to_save.pop("predictions", None)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results_to_save, f, indent=2, ensure_ascii=False)

    print(f"💾 Results saved to: {output_file}")
    return str(output_file)


def main():
    parser = argparse.ArgumentParser(
        description="RAGnosis RAGAS Evaluation"
    )
    parser.add_argument(
        "--golden_data",
        default=DEFAULT_GOLDEN_DATA,
        help="Path to golden dataset JSONL file",
    )
    parser.add_argument(
        "--max_samples",
        type=int,
        default=None,
        help="Maximum number of samples to evaluate",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Skip first N questions (for range testing)",
    )
    parser.add_argument(
        "--top_k",
        type=int,
        default=5,
        help="Number of sources to retrieve",
    )
    parser.add_argument(
        "--llm_model",
        default=DEFAULT_LLM_MODEL,
        help="LLM model for RAGAS evaluation",
    )
    parser.add_argument(
        "--llm_base_url",
        default=DEFAULT_LLM_BASE_URL,
        help="LLM base URL",
    )
    parser.add_argument(
        "--embedding_model",
        default=DEFAULT_EMBEDDING_MODEL,
        help="Embedding model for RAGAS",
    )
    parser.add_argument(
        "--edge_function_url",
        default=DEFAULT_EDGE_FUNCTION_URL,
        help="Edge function URL",
    )
    parser.add_argument(
        "--output_dir",
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for results",
    )
    parser.add_argument(
        "--save_predictions",
        action="store_true",
        help="Save individual predictions to file",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help="Request timeout in seconds",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("🚀 RAGnosis RAGAS Evaluation")
    print("=" * 70)

    # Initialize evaluator
    evaluator = RAGnosisEvaluator(
        edge_function_url=args.edge_function_url,
        llm_model=args.llm_model,
        llm_base_url=args.llm_base_url,
        embedding_model=args.embedding_model,
        timeout=args.timeout,
    )

    # Load golden dataset
    questions = evaluator.load_golden_dataset(
        args.golden_data,
        max_samples=args.max_samples,
        offset=args.offset
    )

    # Run evaluation
    results = evaluator.evaluate_dataset(
        questions,
        top_k=args.top_k,
        save_predictions=args.save_predictions,
        output_dir=args.output_dir,
    )

    # Display results
    print_results(results)

    # Save results
    save_results(results, args.output_dir)


if __name__ == "__main__":
    main()
