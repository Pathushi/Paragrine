from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Although we aren't using it for the product, 
    # it's good to keep for emergencies.
    path('admin/', admin.site.urls),

    # The main Paragrine API
    path('api/', include('core.urls')),

    # Requirement: Captcha functionality
    path('captcha/', include('captcha.urls')),
]

# This allows Django to serve media and static assets safely during dev phases
if settings.DEBUG:
    # 1. FIXED: Changed 'document_address' to 'document_root' for your static files
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    
    # 2. 🛠️ ADDED: Appends the custom media serving route for profile pictures
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)