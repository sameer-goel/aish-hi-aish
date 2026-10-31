import os, pty, re, subprocess, time, json, urllib.request, threading

env_path = "/Users/440k/projects/aish-hi-aish/.env.local"
WABA_ID = "1026312127162635"

def get_env_val(key):
    txt = open(env_path).read()
    m = re.search(rf"{key}=(.+)", txt)
    return m.group(1).strip() if m else ""

def save_tunnel_to_supabase(base_url):
    sb_url = get_env_val("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = get_env_val("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not sb_url or not sb_key:
        return
    try:
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/profiles?on_conflict=phone",
            data=json.dumps({
                "phone": "SYSTEM_TUNNEL",
                "display_name": base_url,
                "relationship": "System Tunnel",
                "role": "guest",
                "invite_code": "AISH2026"
            }).encode("utf-8"),
            headers={
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            method="POST"
        )
        urllib.request.urlopen(req, timeout=8).read()
    except Exception as e:
        with open("/tmp/meta-webhook-sync.log", "a") as lf:
            lf.write(f"[SUPABASE TUNNEL SAVE WARN] {e}\n")

def register_meta_webhook(base_url):
    callback_url = f"{base_url}/api/whatsapp/webhook"
    with open("/tmp/current-tunnel-url.txt", "w") as tf:
        tf.write(base_url)
    save_tunnel_to_supabase(base_url)
    for attempt in range(6):
        time.sleep(2)
        try:
            token = get_env_val("WHATSAPP_ACCESS_TOKEN")
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
            data = os.read(master, 4096)
            if not data:
                break
            chunk = data.decode("utf-8", errors="ignore")
            buf += chunk
            m = re.search(r"https://[a-z0-9]+\.lhr\.life", buf)
            if m and m.group(0) != registered_url:
                registered_url = m.group(0)
                threading.Thread(target=register_meta_webhook, args=(registered_url,), daemon=True).start()
        except OSError:
            break
    os.close(master)
    p.wait()
    time.sleep(2)
