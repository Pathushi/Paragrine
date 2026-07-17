from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static

from .views import (
    UserViewSet,
    AnsibleControllerViewSet,
    UserGroupViewSet,
    UserExecutionHistoryView,
    CaptchaView,
    LoginView,
    VerifyPinView,
    ForgotPasswordView,
    TaskAssignmentView,
    MyTasksView,
    RunTaskView,
    ScheduledTaskViewSet,
    PlaybookCacheViewSet,
    system_stats
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'controllers', AnsibleControllerViewSet) # Added
router.register(r'groups', UserGroupViewSet)
router.register(r'schedules', ScheduledTaskViewSet, basename='schedules')
router.register(r'playbook-cache', PlaybookCacheViewSet, basename='playbook-cache')

urlpatterns = [
    path('auth/stats/', system_stats, name='system_stats'),
    path('auth/captcha/', CaptchaView.as_view(), name='captcha'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/verify-pin/', VerifyPinView.as_view(), name='verify-pin'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('tasks/assignments/', TaskAssignmentView.as_view(), name='task-assignments'),
    path('user/my-tasks/', MyTasksView.as_view(), name='my-tasks'),
    path('user/run-task/', RunTaskView.as_view(), name='run-task'),
    path('tasks/user-history/', UserExecutionHistoryView.as_view(), name='user-execution-history'),
    path('', include(router.urls)),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
