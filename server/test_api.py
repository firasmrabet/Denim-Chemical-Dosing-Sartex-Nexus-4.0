import urllib.request, json

anomalies = json.loads(urllib.request.urlopen('http://localhost:5000/api/ai/anomalies').read())
insights = json.loads(urllib.request.urlopen('http://localhost:5000/api/ai/insights').read())
health = json.loads(urllib.request.urlopen('http://localhost:5000/api/ai/health').read())

print(f"Anomalies: {len(anomalies)}")
print(f"Insights: {len(insights)}")
print(f"Health: {len(health)}")

print("--- Anomalies sample ---")
for a in anomalies[:5]:
    print(f"  Product {a['event']['productId']}, z={a['z']}, severity={a['severity']}")

print("--- Insights ---")
for i in insights:
    print(f"  Product {i['productId']}, overshoot={i['overshootPct']}%, savings={i['monthlySavings']} TND")

print("--- Health ---")
for h in health:
    print(f"  Product {h['productId']}, score={h['score']}%")
