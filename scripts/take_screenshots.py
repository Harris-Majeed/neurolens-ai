"""Take README screenshots of the running app: python scripts/take_screenshots.py"""
import os
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8000"
OUT = "screenshots"
os.makedirs(OUT, exist_ok=True)


def settle(page):
    page.evaluate("document.getElementById('toast').className='toast'")
    page.wait_for_timeout(500)


def run_sample(page, idx):
    page.evaluate("location.hash='#/overview'")
    page.wait_for_selector(".bench-card")
    page.locator(".bench-card").nth(idx).click()
    page.wait_for_function("location.hash==='#/workspace'")
    page.wait_for_selector(".res-label")
    page.wait_for_timeout(700)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    page.goto(URL)
    page.wait_for_selector("#status.ok", timeout=30000)
    page.wait_for_selector(".bench-card")

    # meningioma, no tumor, pituitary, then glioma sample 1 last (it stays open in the workspace)
    for idx in (2, 3, 4, 0):
        run_sample(page, idx)
    settle(page)
    page.screenshot(path=f"{OUT}/workspace.png")

    page.evaluate("location.hash='#/overview'")
    page.wait_for_selector("tbody tr")
    settle(page)
    page.screenshot(path=f"{OUT}/overview.png", full_page=True)

    page.set_viewport_size({"width": 1440, "height": 1500})
    page.click('a.nav-item[data-page="segmentation"]')
    page.wait_for_selector(".case-card")
    page.click("text=Worst whole-tumor Dice")
    page.wait_for_function(
        "!document.querySelector('.loading') && document.querySelectorAll('.views canvas').length===3"
        " && document.querySelector('.case-card.on').textContent.includes('01204')",
        timeout=90000)
    page.wait_for_timeout(1200)
    page.get_by_role("button", name="Disagreement").click()
    settle(page)
    page.screenshot(path=f"{OUT}/segmentation.png")

    page.set_viewport_size({"width": 1440, "height": 1300})
    page.click('a.nav-item[data-page="model"]')
    page.wait_for_selector(".cm")
    page.wait_for_timeout(800)
    settle(page)
    page.screenshot(path=f"{OUT}/model-lab.png")
    browser.close()

for f in sorted(os.listdir(OUT)):
    print(f"{f}  {os.path.getsize(os.path.join(OUT, f)) / 1e6:.1f} MB")