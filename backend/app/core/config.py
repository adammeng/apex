import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录的绝对路径（config.py 在 backend/app/core/ 下，上三级即 backend/）
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
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
    # 可通过环境变量 ALLOWED_ORIGINS 传入逗号分隔的域名列表
    # 生产示例：ALLOWED_ORIGINS=https://apex.adammeng.xyz
    allowed_origins: List[str] = _DEV_ORIGINS

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> List[str]:
        """支持逗号分隔字符串或列表两种格式"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # type: ignore[return-value]

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # 飞书
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_redirect_uri: str = "http://localhost:8000/api/auth/feishu/callback"

    # 前端地址
    frontend_url: str = "http://127.0.0.1:5173"

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

    # 数据目录（导出文件等运行时产物）
    data_dir: str = "/data"

    @model_validator(mode="after")
    def validate_paths(self) -> "Settings":
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
        (Path(self.data_dir) / "exports").mkdir(parents=True, exist_ok=True)
        # 确保 parquet 目录存在
        self.parquet_path.mkdir(parents=True, exist_ok=True)
        return self

    @property
    def data_path(self) -> Path:
        return Path(self.data_dir)

    @property
    def exports_dir(self) -> Path:
        return self.data_path / "exports"

    # parquet 固定存放在 backend/parquet/，不通过环境变量配置
    @property
    def parquet_path(self) -> Path:
        return _BACKEND_DIR / "parquet"

    # Parquet 文件名（固定，由 Pharmcube 导出规范决定）
    parquet_ci_tracking: str = "pharmcube2harbour_ci_tracking_info_0.parquet"
    parquet_clinical_detail: str = (
        "pharmcube2harbour_clinical_trial_detail_info_0.parquet"
    )
    parquet_drug_pipeline: str = "pharmcube2harbour_drug_pipeline_info_0.parquet"

    # 定时同步
    sync_hour: int = 5
    sync_minute: int = 10

    # 阿里云 OSS
    oss_endpoint: str = "https://oss-cn-hangzhou.aliyuncs.com"
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_bucket_name: str = "apex-oss"
    oss_prefix: str = ""

    @property
    def is_development(self) -> bool:
        return self.debug or self.environment.lower() == "development"

    @property
    def allowed_origin_regex(self) -> Optional[str]:
        if not self.is_development:
            return None

        # 开发模式不限制 Origin，方便 localhost / 127 / 局域网 IP / 临时代理统一访问。
        return r".*"


@lru_cache
def get_settings() -> Settings:
    env_file_override = os.getenv("APEX_ENV_FILE", "").strip()
    if env_file_override:
        env_files = (env_file_override,)
    else:
        # 加载顺序（后者覆盖前者同名键）：
        #   开发：.env → .env.local
        #   生产（docker）：环境变量由 docker compose env_file 注入，无需读文件
        #   服务器手动维护的密钥覆盖：.env.production.local（gitignore，不提交）
        candidates = [
            _BACKEND_DIR / ".env",
            _BACKEND_DIR / ".env.local",
            _BACKEND_DIR / ".env.production.local",
        ]
        env_files = tuple(str(p) for p in candidates if p.exists())
    return Settings(_env_file=env_files or None)
