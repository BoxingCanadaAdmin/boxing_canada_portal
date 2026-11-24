"""Walk the coach evaluation flow in the real portal (WordPress test site) as each role."""
import json, sys, re, subprocess
import os
HERE = os.path.dirname(os.path.abspath(__file__))
WPCLI = os.path.join(HERE, "wpcli.php")
from playwright.sync_api import sync_playwright

subprocess.run(['php', WPCLI, 'BCP_Store::wipe(); BCP_Store::import_dataset(json_decode(file_get_contents(BCP_DIR."data/demo-seed.json"), true)); BCP_Coach_Eval::migrate(); BCP_Accounts::create_demo_logins();'], check=True)

BASE = 'http://localhost:8080'
SHOTS = os.path.join(HERE, 'screenshots') + '/'
os.makedirs(SHOTS, exist_ok=True)
errors = []


def login(ctx, ident):
    ctx.clear_cookies()
    r = ctx.request.post(BASE + '/wp-json/bcp/v1/login', data=json.dumps({'login': ident, 'password': 'Password123!'}), headers={'Content-Type': 'application/json'})
    assert r.ok, r.text()


def page_for(ctx):
    p = ctx.new_page()
    p.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    p.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    return p


def open_portal(p):
    p.goto(BASE + '/portal/')
    p.wait_for_selector('nav[aria-label="Sections"]', timeout=20000)
    p.wait_for_timeout(1200)


def tab(p, label):
    p.locator('nav[aria-label="Sections"] button', has_text=label).first.click()
    p.wait_for_timeout(600)


def shot(p, name, full=True):
    p.screenshot(path=SHOTS + name + '.png', full_page=full)
    print('shot', name)


with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1360, 'height': 900})

    # ---- Evaluator: assignments, readiness check, outstanding email ----
    login(ctx, 'BC-COA-1145')
    p = page_for(ctx)
    open_portal(p)
    tab(p, 'Evaluation Assignments')
    shot(p, '01-evaluator-assignments')
    p.get_by_role('button', name=re.compile('Priya Shah')).first.click()
    p.wait_for_timeout(800)
    shot(p, '02-evaluator-readiness-priya')
    # Confirm one item another way, then send the outstanding-items email.
    p.get_by_role('button', name='Mark as met').first.click()
    p.get_by_placeholder('How you confirmed it').fill('Certificate emailed by the coach')
    p.get_by_role('button', name='Confirm').click()
    p.wait_for_timeout(700)
    p.get_by_role('button', name='Send outstanding items').click()
    p.wait_for_timeout(600)
    shot(p, '03-outstanding-email', full=False)
    p.locator('div[role="dialog"]').get_by_role('button', name='Send', exact=True).click()
    p.wait_for_timeout(1500)
    shot(p, '04-after-outstanding')
    p.get_by_role('button', name=re.compile('All evaluations')).click()
    p.wait_for_timeout(500)

    # In-progress evaluation: review task 9a.
    p.get_by_role('button', name=re.compile('Tyler Okafor')).first.click()
    p.wait_for_timeout(800)
    shot(p, '05-evaluator-workspace-tyler')
    card = p.locator('article', has_text='Analyze the Performance of Boxers')
    card.get_by_placeholder('What went well, and what to improve').fill('Accurate detection on all three videos, and practical corrections.')
    card.get_by_role('button', name='✓ Mark complete').click()
    p.wait_for_timeout(1500)
    page_text = p.inner_text('main')
    print('evaluator sees 2 of 4 complete:', '2 of 4 complete' in page_text)
    p.close()

    # ---- Coach: sees the shared screen, resubmits 9c and submits 9d ----
    login(ctx, 'BC-COA-1231')
    p = page_for(ctx)
    open_portal(p)
    tab(p, 'Certification & Evaluations')
    shot(p, '06-coach-evaluations')
    p.get_by_role('button', name=re.compile('Instruction Beginner evaluation')).first.click()
    p.wait_for_timeout(900)
    shot(p, '07-coach-workspace')
    c9 = p.locator('article', has_text='teaching of a basic skill')
    c9.get_by_placeholder('https://').fill('https://youtu.be/demo-jab-body-v2')
    c9.get_by_role('button', name='Add link').click()
    p.wait_for_timeout(700)
    c9.get_by_role('button', name='Resubmit for review').click()
    p.wait_for_timeout(900)
    d9 = p.locator('article', has_text='teaching of a defensive move')
    d9.locator('button[aria-expanded]').first.click() if d9.get_by_placeholder('https://').count() == 0 else None
    d9.get_by_role('button', name='Submit for review').click()
    p.wait_for_timeout(500)
    print('video required error shown:', 'needs a video' in d9.inner_text())
    d9.get_by_placeholder('https://').fill('https://drive.google.com/file/d/demo-slip/view')
    d9.get_by_role('button', name='Add link').click()
    p.wait_for_timeout(700)
    d9.get_by_role('button', name='Submit for review').click()
    p.wait_for_timeout(1500)
    shot(p, '08-coach-after-submit')
    p.close()

    # ---- Admin: Square intake, assign, pathway editor ----
    login(ctx, 'BC-NSO-0001')
    p = page_for(ctx)
    open_portal(p)
    tab(p, 'Coach Programs')
    shot(p, '09-admin-coach-programs')
    p.get_by_role('button', name='Match to member').first.click()
    p.wait_for_timeout(600)
    shot(p, '10-admin-match-order', full=False)
    p.get_by_role('button', name='Cancel').click()
    p.get_by_role('button', name='Assign evaluator').first.click()
    p.wait_for_timeout(600)
    p.locator('div[role="dialog"] label.cursor-pointer', has_text='Kevin MacDonald').click()
    shot(p, '11-admin-assign', full=False)
    p.get_by_role('button', name='Assign & notify').click()
    p.wait_for_timeout(1500)
    p.locator('tr', has_text='Instruction Beginner').locator('button', has_text='Edit').first.click()
    p.wait_for_timeout(600)
    shot(p, '12-pathway-editor-names', full=False)
    p.locator('div[role="dialog"] button', has_text='Evaluation tasks').click()
    p.wait_for_timeout(400)
    shot(p, '13-pathway-editor-tasks', full=False)
    p.locator('div[role="dialog"]').get_by_role('button', name='Done').click()
    p.close()

    # ---- Evaluator finishes: review 9c/9d and certify ----
    login(ctx, 'BC-COA-1145')
    p = page_for(ctx)
    open_portal(p)
    tab(p, 'Evaluation Assignments')
    p.get_by_role('button', name=re.compile('Tyler Okafor')).first.click()
    p.wait_for_timeout(900)
    for title in ['teaching of a basic skill', 'teaching of a defensive move']:
        art = p.locator('article', has_text=title)
        art.get_by_placeholder('What went well, and what to improve').fill('Clear progression, checked for understanding, specific feedback.')
        art.get_by_role('button', name='✓ Mark complete').click()
        p.wait_for_timeout(1300)
    p.get_by_role('button', name='✓ Record outcome & send feedback').click()
    p.wait_for_timeout(600)
    p.locator('div[role="dialog"] textarea').first.fill('You have a calm, confident verbal style and your demonstrations are technically strong.')
    p.wait_for_timeout(300)
    shot(p, '14-outcome-email', full=False)
    p.get_by_role('button', name='Certify and send').click()
    p.wait_for_timeout(2000)
    shot(p, '15-certified')
    p.close()

    # French view of the coach screen.
    login(ctx, 'BC-COA-1231')
    p = page_for(ctx)
    open_portal(p)
    p.get_by_role('button', name='FR').first.click()
    tab(p, 'Certification')
    p.wait_for_timeout(600)
    shot(p, '16-coach-fr')
    p.close()

    # Mobile coach view.
    mctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
    login(mctx, 'BC-COA-1188')
    p = page_for(mctx)
    p.goto(BASE + '/portal/')
    p.wait_for_timeout(3000)
    shot(p, '17-mobile-home', full=False)
    b.close()

print('\nconsole errors:', len(errors))
for e in errors[:20]:
    print(' ', e[:300])
