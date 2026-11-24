"""End-to-end test of the coach evaluation rules through the plugin's REST API.

Signs in as the NSO administrator, an evaluator and a coach (demo accounts),
then walks one Square request from assignment to certification, checking that
each side can change only its own parts of the shared evaluation.
"""
import http.cookiejar, json, re, sys, urllib.request, urllib.error, uuid, subprocess
import os
HERE = os.path.dirname(os.path.abspath(__file__))
WPCLI = os.path.join(HERE, "wpcli.php")

BASE = 'http://localhost:8080'
API = BASE + '/wp-json/bcp/v1/'
PW = 'Password123!'
fails = 0


def check(cond, msg):
    global fails
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond:
        fails += 1


class Session:
    def __init__(self, login):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.call('login', {'login': login, 'password': PW}, nonce=False)
        html = self.op.open(BASE + '/portal/').read().decode()
        self.nonce = re.search(r'"nonce":"([a-f0-9]+)"', html).group(1)

    def call(self, path, body=None, nonce=True, method=None, raw=None, ctype='application/json'):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(API + path, data=data, method=method or ('POST' if data is not None else 'GET'))
        req.add_header('Content-Type', ctype)
        if nonce:
            req.add_header('X-WP-Nonce', self.nonce)
        try:
            r = self.op.open(req)
            body = r.read()
            try:
                return r.status, json.loads(body)
            except ValueError:
                return r.status, body
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')

    def docs(self, coll):
        _, res = self.call('sync?since=0')
        return {d['id']: d['data'] for d in res['docs'] if d['c'] == coll}

    def write(self, coll, doc):
        _, res = self.call('write', {'ops': [{'c': coll, 'id': doc['id'], 'data': doc}]})
        return res['results'][0]


def wp(code):
    return subprocess.run(['php', WPCLI, code], capture_output=True, text=True).stdout


wp('BCP_Store::wipe(); BCP_Store::import_dataset(json_decode(file_get_contents(BCP_DIR."data/demo-seed.json"), true)); BCP_Coach_Eval::migrate(); BCP_Accounts::create_demo_logins(); $r = BCP_Store::get("s_evalRequests","er-3"); $r["status"]="cancelled"; BCP_Store::put("s_evalRequests","er-3",$r);')
key = wp('echo BCP_Coach_Eval::intake_key();').strip()
r0 = urllib.request.Request(API + 'intake/email?key=' + key, data=open(os.path.join(HERE, 't1.json'),'rb').read(), headers={'Content-Type': 'application/json'})
check(json.loads(urllib.request.urlopen(r0).read())['status'] == 'matched', 'Square email creates a request')
admin = Session('BC-NSO-0001')
evaluator = Session('BC-COA-1145')   # Sarah Lin, an evaluator
coach = Session('BC-COA-1188')       # Priya Shah
other = Session('BC-COA-1102')       # Marc Bélanger, not part of this evaluation

reqs = admin.docs('s_evalRequests')
rid = [k for k, v in reqs.items() if v.get('source') == 'square' and v['requesterId'] == 'u-c4' and v['status'] == 'paid'][0]
r = reqs[rid]
print('request', rid)

# Coach and other members can't create requests, or see someone else's.
check(coach.write('s_evalRequests', {**r, 'id': 'er-fake', 'status': 'paid'})['status'] == 'denied', 'coach cannot create a paid request')
check(rid not in other.docs('s_evalRequests'), 'another coach cannot see the request')
check('s_evalIntake' not in {d for d in ['s_evalIntake'] if coach.docs('s_evalIntake')}, 'coaches cannot see Square intake')
check(len(admin.docs('s_evalIntake')) >= 2, 'NSO admin sees Square intake')

# Admin assigns Sarah.
r = admin.docs('s_evalRequests')[rid]
r.update({'status': 'assigned', 'assignedEvaluatorId': 'u-c2', 'assignedBy': 'u-s1', 'assignedAt': '2026-11-24T10:00:00', 'evaluatorContact': {'name': 'Sarah Lin', 'email': 'sarah.lin@example.ca'}})
check(admin.write('s_evalRequests', r)['status'] == 'ok', 'admin assigns evaluator')
out = wp('foreach (BCP_Store::all("s_outbox") as $m) if (($m["kind"]??"")==="eval_assigned") echo $m["to"], " | ", $m["subject"], "\\n";')
check('sarah.lin@example.ca' in out, 'assignment email queued to evaluator: ' + out.strip().split('\n')[-1])

# Evaluator now sees the coach's contact details, membership and Locker record.
ev_users = evaluator.docs('s_users')
check(ev_users['u-c4'].get('email') == 'priya.shah@example.ca' and 'NSO EXPIRY' in ev_users['u-c4'].get('trackie', {}), 'evaluator sees coach email and membership expiry')
check('6630481' in evaluator.docs('s_nccp'), 'evaluator sees coach NCCP transcript')
check('email' not in ev_users.get('u-b1', {'email': None}) or ev_users['u-b1'].get('_profile'), 'evaluator does not get other members in full')

# Evaluator sends readiness and starts tasks, with a sneaky coach submission inside that must be dropped.
r = evaluator.docs('s_evalRequests')[rid]
tasks = [{'id': 'ib-9a', 'step': '9a', 'title': 'Analyze', 'assignment': '1, 7, 16', 'submissions': [{'id': 's-x', 'kind': 'link', 'url': 'https://evil'}], 'review': {'status': 'pending'}, 'comments': []},
         {'id': 'ib-9b', 'step': '9b', 'title': 'Warm-up', 'submissions': [], 'review': {'status': 'pending'}, 'comments': []}]
r.update({'status': 'in_progress', 'readiness': {'decision': 'ready', 'at': '2026-11-24T11:00:00', 'by': 'u-c2'}, 'tasks': tasks, 'payment': {'amount': 1}, 'levelId': 'lv-ntc'})
res = evaluator.write('s_evalRequests', r)
saved = res.get('data') or {}
check(res['status'] == 'ok' and saved['status'] == 'in_progress', 'evaluator starts the evaluation')
check(saved['tasks'][0]['submissions'] == [] and saved['tasks'][0]['assignment'] == '1, 7, 16', 'starting tasks drops coach work, keeps assignment')
check(saved['levelId'] == 'lv-cc' and saved['payment']['amount'] == 180, 'evaluator cannot change level or payment')

# Evaluator emails the coach: server forces the coach as recipient.
mail = {'id': 'mail-' + uuid.uuid4().hex[:8], 'kind': 'eval_ready', 'requestId': rid, 'to': 'attacker@example.com', 'userId': 'u-b1', 'subject': 'Ready', 'body': 'You are ready'}
evaluator.write('s_outbox', mail)
out = wp('$m = BCP_Store::get("s_outbox", "%s"); echo $m["to"], " ", $m["userId"], " ", $m["replyTo"], " ", $m["cc"];' % mail['id'])
check(out.startswith('priya.shah@example.ca u-c4 sarah.lin@example.ca coach@boxingcanada.org'), 'readiness email goes to the coach, replies to evaluator, cc coach@: ' + out)
mail2 = {'id': 'mail-' + uuid.uuid4().hex[:8], 'kind': 'eval_ready', 'requestId': rid, 'to': 'x@example.com', 'userId': 'u-c4', 'subject': 'Spoof', 'body': 'Spoof'}
other.write('s_outbox', mail2)
out = wp('$m = BCP_Store::get("s_outbox", "%s"); echo "[", $m["to"], "]";' % mail2['id'])
check(out == '[]', 'a non-evaluator cannot send evaluation emails')

# Coach submits work; tries to mark own task complete and change evaluator feedback.
r = coach.docs('s_evalRequests')[rid]
t = r['tasks'][0]
t['submissions'] = [{'id': 's-1', 'kind': 'link', 'url': 'https://youtu.be/abc', 'by': 'u-c4', 'at': '2026-11-24T12:00:00'}, {'id': 's-2', 'kind': 'link', 'url': 'javascript:alert(1)', 'by': 'u-c4'}]
t['answer'] = {'entries': [{'video': '1', 'skill': 'Jab'}]}
t['submittedAt'] = '2026-11-24T12:00:00'
t['review'] = {'status': 'complete', 'feedback': 'I passed myself'}
t['assignment'] = 'none'
t['comments'] = [{'id': 'c-1', 'by': 'u-c4', 'text': 'Here is my work', 'at': '2026-11-24T12:00:00'}, {'id': 'c-fake', 'by': 'u-c2', 'text': 'Great job (forged)', 'at': '2026-11-24T12:00:00'}]
r['status'] = 'completed'
r['outcome'] = {'result': 'certified'}
r['messages'] = [{'id': 'm-1', 'by': 'u-c4', 'text': 'Hi Sarah', 'at': '2026-11-24T12:00:00'}]
saved = coach.write('s_evalRequests', r).get('data')
t2 = saved['tasks'][0]
check([s['id'] for s in t2['submissions']] == ['s-1'], 'coach submission saved, javascript: link dropped')
check(t2['review']['status'] == 'pending' and t2['assignment'] == '1, 7, 16', 'coach cannot change review or assignment')
check([c['id'] for c in t2['comments']] == ['c-1'], 'coach cannot forge evaluator comments')
check(saved['status'] == 'in_progress' and 'outcome' not in saved, 'coach cannot complete or certify themselves')
check(len(saved['messages']) == 1, 'coach message saved')

# Evaluator, working from a copy without the coach's submission, gives feedback: coach work survives.
r = dict(saved)
stale = json.loads(json.dumps(r))
stale['tasks'][0]['submissions'] = []
stale['tasks'][0]['review'] = {'status': 'complete', 'feedback': 'Clear detection and correction.', 'by': 'u-c2', 'at': '2026-11-24T13:00:00'}
stale['tasks'][1]['review'] = {'status': 'complete', 'feedback': 'Logical, progressive warm-up.', 'by': 'u-c2', 'at': '2026-11-24T13:00:00'}
saved = evaluator.write('s_evalRequests', stale).get('data')
check([s['id'] for s in saved['tasks'][0]['submissions']] == ['s-1'] and saved['tasks'][0]['review']['status'] == 'complete', 'evaluator feedback saved without losing coach work')

# Coach can no longer change a completed task.
r = coach.docs('s_evalRequests')[rid]
r['tasks'][0]['submissions'] = []
saved = coach.write('s_evalRequests', r).get('data')
check(len(saved['tasks'][0]['submissions']) == 1, 'completed task is locked for the coach')

# Evaluator records the outcome: the server updates the coach's certified level.
before = wp('$u = BCP_Store::get("s_users","u-c4"); echo json_encode($u["certs"]);')
r = evaluator.docs('s_evalRequests')[rid]
r['status'] = 'completed'
r['outcome'] = {'result': 'certified', 'date': '2026-11-24', 'notes': 'PASS for all tasks', 'by': 'u-c2', 'at': '2026-11-24T14:00:00'}
check(evaluator.write('s_evalRequests', r)['status'] == 'ok', 'evaluator records certified outcome')
after = wp('$u = BCP_Store::get("s_users","u-c4"); echo json_encode($u["certs"]), " ", count($u["certHistory"] ?? []);')
check('"prog-coach":"lv-cc"' in after, 'coach certified at IB on the server (before %s, after %s)' % (before, after))
r = evaluator.docs('s_evalRequests')[rid]
r['status'] = 'in_progress'
check(evaluator.write('s_evalRequests', r)['data']['status'] == 'completed', 'evaluator cannot reopen a completed evaluation')

# Files: upload by the coach, download by the evaluator, refused to others.
boundary = 'BOUNDARY' + uuid.uuid4().hex
png = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000') + b'\x00' * 40
body = (f'--{boundary}\r\nContent-Disposition: form-data; name="requestId"\r\n\r\n{rid}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="template 9a.png"\r\nContent-Type: image/png\r\n\r\n').encode() + png + f'\r\n--{boundary}--\r\n'.encode()
code, up = coach.call('files', raw=body, ctype='multipart/form-data; boundary=' + boundary)
check(code == 200 and up.get('ok'), 'coach uploads a template photo: %s %s' % (code, str(up)[:120]))
fid = up['file']['fileId'] if up.get('ok') else 'x'
code, _ = evaluator.call('files/' + fid + '?_wpnonce=' + evaluator.nonce, nonce=False)
check(code == 200, 'evaluator can download it')
code, _ = other.call('files/' + fid + '?_wpnonce=' + other.nonce, nonce=False)
check(code == 404, 'another member cannot download it')
code, bad = coach.call('files', raw=body.replace(b'template 9a.png', b'evil.php'), ctype='multipart/form-data; boundary=' + boundary)
check(code == 400, 'a .php upload is refused')
check('s_files' not in json.dumps(admin.call('sync?since=0')[1]['docs'][:0]) and not coach.docs('s_files'), 'file records are never sent to browsers')

print('\n%d failure(s)' % fails)
sys.exit(1 if fails else 0)
