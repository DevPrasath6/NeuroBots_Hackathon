import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'alloy_backend.settings')
django.setup()

from alloy_api.advanced_views import production_trends, process_analytics_stats
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()

print("--- Testing production_trends ---")
try:
    req = factory.get('/api/charts/production-trends/')
    resp = production_trends(req)
    print("Status:", resp.status_code)
    print("Data:", resp.data)
except Exception as e:
    import traceback
    traceback.print_exc()

print("\n--- Testing process_analytics_stats ---")
try:
    req = factory.get('/api/charts/process-analytics/')
    resp = process_analytics_stats(req)
    print("Status:", resp.status_code)
    print("Data:", resp.data)
except Exception as e:
    import traceback
    traceback.print_exc()
