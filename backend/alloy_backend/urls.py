
from django.contrib import admin
from django.urls import path, include

from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "online", "service": "metallisense-backend"})

urlpatterns = [
    path('', health_check),
    path('admin/', admin.site.urls),
    path('api/', include('alloy_api.urls')),
]
