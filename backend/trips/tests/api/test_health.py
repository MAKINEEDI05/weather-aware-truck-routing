import pytest
from django.conf import settings
from django.test import Client

HEALTH_PATHS = ["/api/v1/health/", "/api/health/"]


@pytest.mark.parametrize("path", HEALTH_PATHS)
def test_health_returns_ok_and_version(client: Client, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
    assert response["Content-Type"] == "application/json"
    assert response.json() == {"status": "ok", "version": settings.APP_VERSION}


def test_health_rejects_other_methods(client: Client) -> None:
    response = client.post("/api/v1/health/", data={}, content_type="application/json")

    assert response.status_code == 405


def test_health_allows_configured_frontend_origin(client: Client) -> None:
    response = client.get("/api/v1/health/", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://localhost:5173"


def test_health_does_not_allow_unknown_origin(client: Client) -> None:
    response = client.get("/api/v1/health/", headers={"Origin": "https://evil.example"})

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response


def test_cors_preflight_from_frontend_origin(client: Client) -> None:
    response = client.options(
        "/api/v1/health/",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://localhost:5173"
