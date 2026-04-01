from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # repo root


class Settings(BaseSettings):
    # 应用基础
    app_name: str = "Apex API"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"

    # API
    api_prefix: str = "/api"
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 小时

    # 飞书
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_redirect_uri: str = "http://localhost:8000/api/auth/feishu/callback"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 3600  # 默认 1 小时

    # MySQL
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "apex"
    mysql_password: str = "apex_password"
    mysql_database: str = "apex"

    @property
    def mysql_dsn(self) -> str:
        return (
            f"mysql+aiomysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
        )

    # DuckDB / 数据路径
    data_dir: Path = BASE_DIR / "data"
    parquet_dir: Path = BASE_DIR / "parquet"

    @property
    def raw_data_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def exports_dir(self) -> Path:
        return self.data_dir / "exports"

    # Parquet 文件名
    parquet_ci_tracking: str = "pharmcube2harbour_ci_tracking_info_0.parquet"
    parquet_clinical_detail: str = (
        "pharmcube2harbour_clinical_trial_detail_info_0.parquet"
    )
    parquet_drug_pipeline: str = "pharmcube2harbour_drug_pipeline_info_0.parquet"

    @property
    def ci_tracking_path(self) -> Path:
        return self.parquet_dir / self.parquet_ci_tracking

    @property
    def clinical_detail_path(self) -> Path:
        return self.parquet_dir / self.parquet_clinical_detail

    @property
    def drug_pipeline_path(self) -> Path:
        return self.parquet_dir / self.parquet_drug_pipeline

    # 定时任务
    sync_hour: int = 5
    sync_minute: int = 10

    # OSS（数据同步）
    oss_endpoint: str = ""
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_bucket_name: str = ""
    oss_prefix: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
