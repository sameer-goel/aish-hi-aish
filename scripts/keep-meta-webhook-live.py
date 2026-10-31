import os, pty, re, subprocess, time, json, urllib.request

env_path = "/Users/440k/projects/aish-hi-aish/.env.local"
WABA_ID = "1026312127162635"

def get_token():
    txt = open(env_path).read()
    m = re.search(r"WHATSAPP_ACCESS_TOKEN=(.+)", txt)
    return m.group(1).strip() if m else ""

def register_meta_webhook(base_url):
    callback_url = f"{base_url}/api/whatsapp/webhook"
    with open("/tmp/current-tunnel-url.txt", "w") as tf:
        tf.write(base_url)
    for attempt in range(6):
        time.sleep(3)
        try:
            token = get_token()
            req = urllib.request.Request(
                f"https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps",
                data=json.dumps({
                    "override_callback_uri": callback_url,
                    "verify_token": "AISH2026"
                }).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                with open("/tmp/meta-webhook-sync.log", "a") as lf:
                    lf.write(f"[OK] Registered {callback_url} -> {body}\n")
                return True
        except Exception as e:
            with open("/tmp/meta-webhook-sync.log", "a") as lf:
                lf.write(f"[RETRY {attempt}] {callback_url} -> {e}\n")
    return False

while True:
    master, slave = pty.openpty()
    p = subprocess.Popen(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=20", "-R", "80:localhost:3000", "nokey@localhost.run"],
        stdin=slave, stdout=slave, stderr=slave, close_fds=True
    )
    os.close(slave)
    registered_url = None
    buf = ""
    while True:
        try:
            data = os.read(master, 1024)
            if not data:
                break
            chunk = data.decode("utf-8", errors="ignore")
            buf += chunk
            m = re.search(r"https://[a-z0-9]+\.lhr\.life", buf)
            if m and m.group(0) != registered_url:
                registered_url = m.group(0)
                register_meta_webhook(registered_url)
        except OSError:
            break
    os.close(master)
    p.wait()
    time.sleep(2)
