#!/usr/bin/env python3
"""Writes .data/backup.json from the local app's database, for 'Import backup' in the Chrome extension. Read-only."""
import datetime, json, os, sqlite3
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
c = sqlite3.connect(f"file:{root}/.data/orders.db?mode=ro", uri=True)
orders = [json.loads(r[0]) for r in c.execute("select data from orders where source='real'")]
goals = [json.loads(r[0]) for r in c.execute("select data from goals")] if c.execute("select 1 from sqlite_master where name='goals'").fetchone() else []
prices = {r[0]: r[1] for r in c.execute("select name, price from prices")} if c.execute("select 1 from sqlite_master where name='prices'").fetchone() else {}
out = f"{root}/.data/backup.json"
json.dump({"app": "money-tracker", "version": 1, "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "orders": orders, "goals": goals, "prices": prices}, open(out, "w"))
print(f"Wrote {out}: {len(orders)} orders, {len(goals)} goals")
