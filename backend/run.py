import uvicorn

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    use_reload = settings.debug or settings.app_env.lower() == "dev"

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=use_reload,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()

