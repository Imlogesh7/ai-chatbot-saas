-- Fix vector column dimension from 1536 (OpenAI) to 768 (nomic-embed-text / Ollama)
-- and 384 fall-through for HuggingFace all-MiniLM-L6-v2.
-- We standardise on 768 to match the primary embedding provider (Ollama nomic-embed-text).
-- Existing chunks must be cleared because pgvector cannot change dimension in-place.

-- Drop dependent HNSW index first
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Clear existing chunks (dimension mismatch makes them unusable anyway)
DELETE FROM document_chunks;

-- Alter column to correct dimension
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector(768)
  USING NULL;

-- Re-create HNSW index with explicit dimension
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
