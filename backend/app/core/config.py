from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # 只读 backend/.env，启动目录就是 backend/
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用基础
    app_name: str = "Apex API"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "production"

    # API
    api_prefix: str = "/api"
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # 飞书（App ID 前后端都要，Secret 只在后端）
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_redirect_uri: str = "http://localhost:8000/api/auth/feishu/callback"

    # 前端地址（OAuth 回调后重定向目标）
    frontend_url: str = "http://localhost:5173"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 3600

    # MySQL
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "apex"
    mysql_password: str = ""
    mysql_database: str = "apex"

    @property
    def mysql_dsn(self) -> str:
        return (
            f"mysql+aiomysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
        )

    # 数据路径（必须通过 .env 显式配置，不做目录结构假设）
    data_dir: str = "/data"
    parquet_dir: str = "/parquet"

    @model_validator(mode="after")
    def validate_paths(self) -> "Settings":
        # 确保目录存在（data_dir 的子目录，parquet_dir 外部挂载不强制）
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
        (Path(self.data_dir) / "raw").mkdir(parents=True, exist_ok=True)
        (Path(self.data_dir) / "exports").mkdir(parents=True, exist_ok=True)
        return self

    @property
    def data_path(self) -> Path:
        return Path(self.data_dir)

    @property
    def parquet_path(self) -> Path:
        return Path(self.parquet_dir)

    @property
    def raw_data_dir(self) -> Path:
        return self.data_path / "raw"

    @property
    def exports_dir(self) -> Path:
        return self.data_path / "exports"

    # Parquet 文件名（固定，由 Pharmcube 导出规范决定）
    parquet_ci_tracking: str = "pharmcube2harbour_ci_tracking_info_0.parquet"
    parquet_clinical_detail: str = (
        "pharmcube2harbour_clinical_trial_detail_info_0.parquet"
    )
    parquet_drug_pipeline: str = "pharmcube2harbour_drug_pipeline_info_0.parquet"

    @property
    def ci_tracking_path(self) -> Path:
        return self.parquet_path / self.parquet_ci_tracking

    @property
    def clinical_detail_path(self) -> Path:
        return self.parquet_path / self.parquet_clinical_detail

    @property
    def drug_pipeline_path(self) -> Path:
        return self.parquet_path / self.parquet_drug_pipeline

    # 定时同步
    sync_hour: int = 5
    sync_minute: int = 10

    # 阿里云 OSS
    oss_endpoint: str = "https://oss-cn-hangzhou.aliyuncs.com"
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_bucket_name: str = "apex-oss"
    oss_prefix: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
