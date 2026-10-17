"""Rebuild data/rbi-dla-<date>.json from RBI's public directory of digital lending apps.

Source: Reserve Bank of India, "DLA's deployed by Regulated Entities", linked from the rbi.org.in home
page (Citizen's Corner). Lenders report their apps to RBI's CIMS portal and RBI publishes the list as a
SAP BusinessObjects report at data.rbi.org.in, opened through a public guest link. This script follows
that link, asks the report's REST API (Raylight) for a CSV export, and keeps only four public facts per
row: app name, lender, lender type and the app link RBI lists. The grievance officers' names, emails and
phone numbers that RBI's report also carries are dropped while parsing and never written anywhere.

Rows are de-duplicated on (app, lender), ignoring case, keeping the first in RBI's order, and sorted by
app then lender. "Entity Name" is a merged cell in RBI's export (blank on continuation rows), so it is
filled down. Values are kept as RBI lists them, junk rows included.

This only reads from RBI and writes a local file; it never touches Arkiv. scripts/mirror-dla.ts publishes
the snapshot.

Needs Python 3.10+ with requests and beautifulsoup4.
Usage:
  python3 scripts/fetch-dla.py                          # fetch from RBI, write data/rbi-dla-<today IST>.json
  python3 scripts/fetch-dla.py --csv "Digital Lending App.csv" --date 2026-10-17   # rebuild from a saved export
"""
import argparse, csv, html, io, json, re, sys, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin

START = "https://data.rbi.org.in/BOE/OpenDocument/opendoc/custom.jsp?sIDType=CUID&iDocID=ARfEgy.WNSVIvFfvSIVmBCw"
# The proxy path carries the BusinessObjects build number seen on 17 Oct 2026; if RBI upgrades the server,
# take the new one from the OpenDocument page's network requests.
PROXY = "https://data.rbi.org.in/BOE/OpenDocument/2409211437/biprwsproxy/biprws"
DOC = "17459177"  # the "Digital Lending App" document behind the CUID above
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
SOURCE = ("Reserve Bank of India, 'DLA's deployed by Regulated Entities' (Citizen's Corner), as published on rbi.org.in. "
          "Minimal facts only: app name, lender, lender type, app link. Grievance officer details are deliberately left out.")


def fetch_csv() -> str:
    """Log in as RBI's public guest link does, refresh the report and export it as CSV."""
    import requests
    from bs4 import BeautifulSoup

    s = requests.Session()
    s.headers["User-Agent"] = UA
    r = s.get(START, timeout=60)
    ser = None
    # The guest link is a chain of auto-submitting forms that ends with a SerializedSession.
    for _ in range(6):
        m = re.search(r"SerializedSession=([^&\"']+)", r.text)
        if m and "logonSuccessful" in r.url:
            ser = unquote(m.group(1))
            break
        form = BeautifulSoup(r.text, "html.parser").find("form")
        if form is None:
            break
        data = {i.get("name"): i.get("value") or "" for i in form.find_all("input") if i.get("name")}
        if "isApplication" in data and not data["isApplication"]:  # the first page fills these in JavaScript
            data["isApplication"], data["appKind"] = "true", "OpenDocument"
            mm = re.search(r'userParamsList\.value="([^"]*)"', r.text)
            if mm:
                data["userParamsList"] = mm.group(1)
        r = s.post(urljoin(r.url, html.unescape(form.get("action") or r.url)), data=data, timeout=120)
    if not ser:
        sys.exit("RBI's guest link did not return a session; open the directory in a browser to check it still works")

    body = ('<attrs xmlns="http://www.sap.com/rws/bip"><attr name="logonToken" type="string">%s</attr>'
            '<attr name="tokenType" type="string" possibilities="token, serializedSession">serializedSession</attr></attrs>'
            ) % html.escape(ser, quote=False)
    r = s.post(f"{PROXY}/logon/token", data=body, headers={"Content-Type": "application/xml", "Accept": "application/xml"}, timeout=60)
    r.raise_for_status()
    token = html.unescape(re.search(r'name="logonToken" type="string">([^<]+)<', r.text).group(1))
    h = {"X-SAP-LogonToken": f'"{token}"', "Accept": "application/json"}
    rl = f"{PROXY}/raylight/v1/documents/{DOC}"
    try:
        # Refreshing the document runs its query, so the export is current, not a cached copy.
        s.put(f"{rl}/parameters", headers={**h, "Content-Type": "application/json"}, data='{"parameters":{"parameter":[]}}', timeout=300).raise_for_status()
        r = s.get(rl, headers={**h, "Accept": "text/csv"}, timeout=600)
        r.raise_for_status()
    finally:
        s.post(f"{PROXY}/logoff", headers=h, timeout=30)
    raw = r.content
    if raw[:2] == b"PK":  # the CSV export comes zipped, one file per report
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            raw = z.read(next(n for n in z.namelist() if n.lower().endswith(".csv")))
    return raw.decode("utf-8-sig")


def clean(v: str | None) -> str:
    return re.sub(r"\s+", " ", v or "").strip()


def minimal_rows(text: str) -> list[dict]:
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))
    head = next(i for i, r in enumerate(rows) if r and r[0] == "Sr. No")
    col = {name: i for i, name in enumerate(rows[head])}
    need = ["Entity Name", "Entity Type", "Name of the DLA", "Link to DLA"]
    missing = [n for n in need if n not in col]
    if missing:
        sys.exit(f"RBI's export changed: no column {missing}")
    seen: dict[tuple[str, str], dict] = {}
    lender = ""
    for r in rows[head + 1:]:
        if not r or not r[0].strip():
            continue
        # Read only the four columns we keep; the grievance officer columns are never touched.
        get = lambda n: r[col[n]] if col[n] < len(r) else ""
        if get("Entity Name").strip():
            lender = get("Entity Name")
        row = {
            "app": clean(get("Name of the DLA")),
            "lender": clean(lender),
            "lenderType": clean(get("Entity Type")),
            "url": re.sub(r"^[^A-Za-z0-9]+", "", clean(get("Link to DLA"))),
        }
        seen.setdefault((row["app"].lower(), row["lender"].lower()), row)
    return sorted(seen.values(), key=lambda x: (x["app"].lower(), x["lender"].lower()))


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", help="rebuild from a CSV export saved earlier instead of fetching")
    ap.add_argument("--date", help="snapshot date, YYYY-MM-DD (default: today in IST)")
    ap.add_argument("--out", help="output file (default: data/rbi-dla-<date>.json)")
    a = ap.parse_args()

    now = datetime.now(timezone.utc)
    date = a.date or (now + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d")
    text = Path(a.csv).read_text(encoding="utf-8-sig") if a.csv else fetch_csv()
    rows = minimal_rows(text)
    out = Path(a.out or Path(__file__).resolve().parent.parent / "data" / f"rbi-dla-{date}.json")
    snap = {
        "source": SOURCE,
        "snapshot": date,
        "fetched": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "apps": len(rows),
        "lenders": len({r["lender"].lower() for r in rows}),
        "rows": rows,
    }
    out.write_text(json.dumps(snap, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{snap['apps']} app and lender pairs from {snap['lenders']} lenders -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
