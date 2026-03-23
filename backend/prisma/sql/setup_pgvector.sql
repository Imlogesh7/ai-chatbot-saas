-- Run this BEFORE prisma migrate if your DB user doesn't have CREATE EXTENSION rights.
-- Requires superuser or rds_superuser on managed databases.

CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index for cosine similarity on document_chunks.
-- m=16: max bi-directional links per node (higher = more accurate, more memory)
-- ef_construction=64: candidate list size during build (higher = better recall, slower build)
-- This is also created automatically by VectorStoreService on app startup,
-- but including it here ensures it exists before the first query.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
