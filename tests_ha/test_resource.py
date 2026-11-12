from homeassistant.setup import async_setup_component

_n = [100]
async def _urls(hass, ws):
    _n[0] += 1
    await ws.send_json({"id": _n[0], "type": "lovelace/resources"})
    r = await ws.receive_json()
    return [(x["url"], x["type"]) for x in r["result"]]

async def test_fresh(hass, hass_ws_client):
    assert await async_setup_component(hass, "lovelace", {})
    assert await async_setup_component(hass, "reefi", {})
    await hass.async_start(); await hass.async_block_till_done()
    assert await _urls(hass, await hass_ws_client(hass)) == [("/reefi_static/reefi-studio-card.js?v=0.1.4", "module")]

async def test_hand_added_and_stale_copy(hass, hass_ws_client):
    assert await async_setup_component(hass, "lovelace", {})
    ws = await hass_ws_client(hass)
    for i, (u, t) in enumerate([("/reefi_static/reefi-studio-card.js", "js"),
                                ("/local/reefi-studio-card.js?v=0.1.0", "module"),
                                ("/hacsfiles/other-card/other-card.js", "module")]):
        await ws.send_json({"id": i + 1, "type": "lovelace/resources/create", "res_type": t, "url": u})
        assert (await ws.receive_json())["success"]
    assert await async_setup_component(hass, "reefi", {})
    await hass.async_start(); await hass.async_block_till_done()
    got = await _urls(hass, ws)
    assert sorted(got) == sorted([("/reefi_static/reefi-studio-card.js?v=0.1.4", "module"),
                                  ("/hacsfiles/other-card/other-card.js", "module")]), got
    # restart again: nothing changes, no duplicates
    from custom_components.reefi.lovelace_resource import _ensure
    await _ensure(hass, "/reefi_static/reefi-studio-card.js", "/reefi_static/reefi-studio-card.js?v=0.1.4", ())
    assert len(await _urls(hass, ws)) == 2
