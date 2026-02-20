from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Page-Proof-QA API"
    app_env: str = "dev"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    log_level: str = "INFO"
    sql_echo: bool = False
    upload_dir: str = "uploads"
    max_upload_bytes: int = 52_428_800
    ocr_fallback_enabled: bool = True
    ocr_trigger_min_words: int = 18
    ocr_trigger_min_alnum_ratio: float = 0.60
    ocr_language: str = "eng"
    ocr_dpi: int = 300
    ocr_full_page: bool = True
    ocr_tessdata: str | None = None
    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-5-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536
    retrieval_top_k: int = 8
    retrieval_max_context_chunks: int = 6
    answer_max_evidence_items: int = 0
    retrieval_min_keyword_overlap: int = 1
    evidence_question_weight: float = 0.2
    evidence_answer_weight: float = 0.8
    evidence_relative_score_threshold: float = 0.60
    evidence_drop_ratio_stop: float = 0.72
    evidence_min_absolute_score: float = 0.20
    retrieval_max_vector_distance: float = 1.2
    minimum_evidence_items: int = 1
    require_llm_citations: bool = True
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/pageproofqa"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
