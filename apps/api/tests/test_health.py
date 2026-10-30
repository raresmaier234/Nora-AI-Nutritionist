def test_health_check_needs_no_sign_in(anon_client) -> None:
    response = anon_client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_the_old_scrape_endpoint_is_gone(client) -> None:
    """The old /foods/scrape fetched any URL on the internet for anyone who asked. Not even a
    signed-in user finds it."""
    response = client.get("/api/v1/foods/scrape", params={"url": "https://example.com"})
    assert response.status_code == 404
