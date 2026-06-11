import pytest
import pytest_asyncio
from httpx import AsyncClient

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(base_url="http://127.0.0.1:8000") as client:
        yield client

@pytest.mark.asyncio
async def test_ping(async_client):
    response = await async_client.get("/api/v1/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "message": "Keep-alive active"}

@pytest.mark.asyncio
async def test_get_active_goal_sheet_employee(async_client):
    # Mock X-User-ID to be an employee, say ID 14 (from seed.py employee loop 1 to 120 -> +13 offset maybe? Employees start at 14 since admins are 1-3, managers are 4-13)
    response = await async_client.get(
        "/api/v1/goals/sheet/active",
        headers={"X-User-ID": "14"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "sheet" in data
    assert "cycle_status" in data
    assert "goals" in data
    assert data["sheet"]["cycle_year"] == 2026

@pytest.mark.asyncio
async def test_manager_team(async_client):
    # Mock X-User-ID to be a manager, say ID 4
    response = await async_client.get(
        "/api/v1/manager/team",
        headers={"X-User-ID": "4"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
