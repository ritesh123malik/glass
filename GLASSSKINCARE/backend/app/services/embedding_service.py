"""Local sentence-transformers embedding service (384-dim for all-MiniLM-L6-v2)."""
from functools import lru_cache
from sentence_transformers import SentenceTransformer

_model = None

def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def generate_embedding(text: str) -> list[float]:
    """Generate 384-dim embedding for a text string."""
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()

def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Batch encode multiple texts."""
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()
