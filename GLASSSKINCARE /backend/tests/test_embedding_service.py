import pytest
from app.services.embedding_service import generate_embedding, generate_embeddings_batch

def test_same_text_cosine_sim_is_1():
    e1 = generate_embedding("oily skin acne prone")
    e2 = generate_embedding("oily skin acne prone")
    from numpy.linalg import norm
    cos_sim = sum(a*b for a,b in zip(e1,e2)) / (norm(e1)*norm(e2))
    assert cos_sim > 0.99

def test_different_texts_not_identical():
    e1 = generate_embedding("dry sensitive skin")
    e2 = generate_embedding("oily acne prone skin")
    assert e1 != e2

def test_batch():
    texts = ["serum for acne", "moisturizer for dry skin"]
    result = generate_embeddings_batch(texts)
    assert len(result) == 2
    assert len(result[0]) == 384
