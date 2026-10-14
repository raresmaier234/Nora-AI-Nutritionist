from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_the_old_scrape_endpoint_is_gone() -> None:
    """The old /foods/scrape fetched any URL on the internet for anyone who asked."""
    response = client.get("/api/v1/foods/scrape", params={"url": "https://example.com"})
    assert response.status_code == 404
