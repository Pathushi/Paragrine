import subprocess
import os
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import action

from django.contrib.auth import authenticate
from captcha.models import CaptchaStore
from captcha.helpers import captcha_image_url
from .services import AnsibleSSHClient

from .models import *
from .serializers import *
import tempfile

# ============================================================
# 1. AUTHENTICATION & SECURITY
# ============================================================

@permission_classes([AllowAny])
class CaptchaView(APIView):
    def get(self, request):
        hashkey = CaptchaStore.generate_key()
        image_url = request.build_absolute_uri(captcha_image_url(hashkey))
        return Response({"hashkey": hashkey, "image_url": image_url})

@permission_classes([AllowAny])
class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        captcha_key = request.data.get('captcha_key')
        captcha_value = request.data.get('captcha_value')
        device_metadata = request.data.get('device_metadata', {})

        try:
            get_captcha = CaptchaStore.objects.get(hashkey=captcha_key)
            if get_captcha.response != captcha_value.lower():
                return Response({"error": "Invalid Captcha"}, status=status.HTTP_400_BAD_REQUEST)
        except:
            return Response({"error": "Captcha expired"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=username, password=password)

        if user is not None:
            if not user.is_enabled:
                return Response({
                    "error": "Access Revoked",
                    "detail": "The administrator has removed your access. Please contact the administrator to regain access to the portal."
                }, status=status.HTTP_403_FORBIDDEN)

            visitor_id = device_metadata.get('visitor_id')
            if not visitor_id:
                return Response({"error": "Security Mismatch: Malformed terminal metadata fingerprint."}, status=400)

            known_devices = UserDevice.objects.filter(user=user)

            if not known_devices.exists():
                UserDevice.objects.create(
                    user=user,
                    visitor_id=visitor_id,
                    os=device_metadata.get('os', 'Unknown'),
                    browser=device_metadata.get('browser', 'Unknown'),
                    screen_resolution=device_metadata.get('screen_resolution', 'Unknown'),
                    timezone=device_metadata.get('timezone', 'Unknown'),
                    canvas_hash=device_metadata.get('canvas_hash', ''),
                    is_trusted=True
                )

            else:
                device_authorized = False
                for dev in known_devices:
                    score = 0
                    if dev.os == device_metadata.get('os'): score += 35
                    if dev.browser == device_metadata.get('browser'): score += 30
                    if dev.canvas_hash == device_metadata.get('canvas_hash'): score += 20
                    if dev.timezone == device_metadata.get('timezone'): score += 10
                    if dev.screen_resolution == device_metadata.get('screen_resolution'): score += 5

                    if score >= 80:
                        if dev.is_trusted:
                            device_authorized = True
                            dev.visitor_id = visitor_id
                            dev.save()
                            break
                        else:
                            return Response({
                                "error": "Device Pending",
                                "detail": "Your terminal profiles exist in the system architecture but are currently awaiting explicit admin authorization fields."
                            }, status=status.HTTP_403_FORBIDDEN)

                if not device_authorized:
                    UserDevice.objects.create(
                        user=user,
                        visitor_id=visitor_id,
                        os=device_metadata.get('os', 'Unknown'),
                        browser=device_metadata.get('browser', 'Unknown'),
                        screen_resolution=device_metadata.get('screen_resolution', 'Unknown'),
                        timezone=device_metadata.get('timezone', 'Unknown'),
                        canvas_hash=device_metadata.get('canvas_hash', ''),
                        is_trusted=False
                    )
                    return Response({
                        "error": "Untrusted Device Signature",
                        "detail": "Security configurations have rejected this platform environment signature. Operations are gated to company-verified assets."
                    }, status=status.HTTP_403_FORBIDDEN)

            return Response({
                "message": "Step 1 Success",
                "require_pin": True,
                "user_id": user.id
            })

        return Response({"error": "Invalid username or password"}, status=status.HTTP_401_UNAUTHORIZED)

@permission_classes([AllowAny])
class VerifyPinView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        pin = request.data.get('pin')
        try:
            if str(user_id).isdigit():
                user = UserProfile.objects.get(id=int(user_id))
            else:
                user = UserProfile.objects.get(username=user_id)

            if not user.is_enabled:
                return Response({"error": "Access Revoked"}, status=status.HTTP_403_FORBIDDEN)

            if str(user.pin).strip() == str(pin).strip():
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user_id': user.id,
                    'user': {
                        'username': user.username,
                        'is_staff': user.is_staff,
                        'full_name': f"{user.first_name} {user.last_name}"
                    }
                })
            return Response({"error": "Invalid PIN"}, status=status.HTTP_401_UNAUTHORIZED)
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

@permission_classes([AllowAny])
class ForgotPasswordView(APIView):
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        new_pin = request.data.get('new_pin')

        if not username or not email or not new_pin:
            return Response({"error": "All verification parameters are required."}, status=400)

        try:
            user = UserProfile.objects.get(username=username, email=email)
            if not user.is_enabled:
                return Response({"error": "Account Isolated", "detail": "Cannot modify credentials for a deactivated profile."}, status=403)

            if len(str(new_pin)) != 6 or not str(new_pin).isdigit():
                return Response({"error": "Validation Error", "detail": "The clearance PIN must be a crisp 6-digit numerical string."}, status=400)

            user.pin = new_pin
            user.save()

            return Response({
                "status": "success",
                "message": "Security baseline updated. Your profile clearance PIN has been re-established."
            }, status=200)

        except UserProfile.DoesNotExist:
            return Response({"error": "Authorization Mismatch", "detail": "Provided recovery parameters do not match system identity records."}, status=404)


@api_view(['GET'])
@permission_classes([AllowAny])
def system_stats(request):
    try:
        total_controllers = AnsibleController.objects.count()
        active_users = UserProfile.objects.filter(is_enabled=True).count()

        # Calculate Success Rate
        total_logs = TaskExecutionLog.objects.count()
        success_logs = TaskExecutionLog.objects.filter(status="Success").count()
        success_rate = round((success_logs / total_logs) * 100) if total_logs > 0 else 0

        # Grab Recent Activity
        recent_logs = TaskExecutionLog.objects.select_related('user').order_by('-execution_time')[:15]
        recent_activity = []
        for log in recent_logs:
            recent_activity.append({
                "id": log.id,
                "playbook": log.playbook_name,
                "user": log.user.username,
                "status": log.status,
                "date": log.execution_time.date().isoformat(),
                "time": log.execution_time.strftime("%I:%M %p"),
                "full_logs": log.logs,
                "is_scheduled": log.is_scheduled
            })

        # Calculate Controller Utilization
        controller_stats = TaskExecutionLog.objects.exclude(controller_name__isnull=True).values('controller_name').annotate(tasks=Count('id'))
        controller_utilization = [{"name": c['controller_name'], "tasks": c['tasks']} for c in controller_stats]

        return Response({
            "total_controllers": total_controllers,
            "active_users": active_users,
            "success_rate": f"{success_rate}%",
            "recent_activity": recent_activity,
            "controller_utilization": controller_utilization
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)

class UserExecutionHistoryView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response([])

        # Fetch the 50 most recent logs for this specific user
        logs = TaskExecutionLog.objects.filter(user_id=user_id).order_by('-execution_time')[:50]

        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "playbook": log.playbook_name,
                "status": log.status,
                "date": log.execution_time.date().isoformat(),
                "time": log.execution_time.strftime("%I:%M %p"),
                "full_logs": log.logs,
                "is_scheduled": log.is_scheduled
            })
        return Response(data)


# 3. USER MANAGEMENT
# ============================================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    @action(detail=True, methods=['post'])
    def toggle_access(self, request, pk=None):
        user = self.get_object()
        user.is_enabled = not user.is_enabled
        user.save()
        return Response({"status": "success", "is_enabled": user.is_enabled})

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='me')
    def manage_my_profile(self, request):
        user_id = request.query_params.get('user_id')

        try:
            user_instance = UserProfile.objects.get(id=user_id) if user_id else request.user

            if not user_instance:
                return Response({"error": "Unauthorized"}, status=401)

        except:
            return Response({"error": "User not found"}, status=404)

        if request.method == 'GET':
            return Response(self.get_serializer(user_instance).data)

        serializer = self.get_serializer(user_instance, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()

            password = request.data.get("password")
            if password:
                user.set_password(password)
                user.save()

            return Response(serializer.data)

        return Response(serializer.errors, status=400)

    def perform_create(self, serializer):
        user = serializer.save(is_enabled=True)
        password = self.request.data.get('password')
        if password:
            user.set_password(password)
            user.save()

    def perform_update(self, serializer):
        user = serializer.save()
        password = self.request.data.get('password')
        if password:
            user.set_password(password)
            user.save()


class UserDeviceViewSet(viewsets.ModelViewSet):
    queryset = UserDevice.objects.all().select_related('user')
    serializer_class = UserDeviceSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    @action(detail=True, methods=['post'])
    def approve_device(self, request, pk=None):
        device = self.get_object()
        device.is_trusted = True
        device.save()
        return Response({"status": "approved"})


# ============================================================
# 4. TASK ASSIGNMENTS ONLY (SIMPLIFIED)
# ============================================================

class TaskAssignmentView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response([])

    def post(self, request):
        return Response({"error": "Task system removed"}, status=400)


class AnsibleControllerViewSet(viewsets.ModelViewSet):
    queryset = AnsibleController.objects.all()
    serializer_class = AnsibleControllerSerializer

    @action(detail=True, methods=['get'])
    def sync_playbooks(self, request, pk=None):
        controller = self.get_object()
        try:
            ssh = AnsibleSSHClient(controller)
            playbooks = ssh.list_playbooks()

            assignments = PlaybookAssignment.objects.filter(controller=controller).select_related('group')
            assignment_map = {}
            for a in assignments:
                if a.playbook_name not in assignment_map:
                    assignment_map[a.playbook_name] = []
                assignment_map[a.playbook_name].append(a.group.name)

            for pb in playbooks:
                pb['assigned_groups'] = assignment_map.get(pb['name'], [])

            return Response(playbooks)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    # --- NEW: PULL ALL PLAYBOOKS INTO CACHE DB ---
    @action(detail=True, methods=['post'])
    def pull_playbooks(self, request, pk=None):
        controller = self.get_object()
        try:
            ssh = AnsibleSSHClient(controller)
            playbooks = ssh.list_playbooks()
            
            synced_names = []
            for pb in playbooks:
                name = pb['name']
                content = ssh.read_playbook(name)
                
                PlaybookCache.objects.update_or_create(
                    controller=controller,
                    name=name,
                    defaults={'content': content}
                )
                synced_names.append(name)
                
            # Cleanup deleted playbooks
            PlaybookCache.objects.filter(controller=controller).exclude(name__in=synced_names).delete()
            
            return Response({"status": "success", "message": f"Successfully pulled and cached {len(synced_names)} playbooks."})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get', 'put', 'delete'], url_path='playbook-details')
    def playbook_details(self, request, pk=None):
        controller = self.get_object()
        playbook_name = request.query_params.get('name')

        if not playbook_name:
            return Response({"error": "Playbook name is required"}, status=400)

        try:
            ssh = AnsibleSSHClient(controller)

            if request.method == 'GET':
                # Try getting from DB first, else fetch SSH
                cache_obj = PlaybookCache.objects.filter(controller=controller, name=playbook_name).first()
                if cache_obj:
                    content = cache_obj.content
                else:
                    content = ssh.read_playbook(playbook_name)

                assignment = PlaybookAssignment.objects.filter(
                    controller=controller,
                    playbook_name=playbook_name
                ).first()

                params = assignment.input_parameters if assignment else {}

                return Response({
                    "name": playbook_name,
                    "content": content,
                    "input_parameters": params
                })

            if request.method == 'PUT':
                new_content = request.data.get('content')
                new_params = request.data.get('input_parameters')

                # 1. Update the actual .yml file on the remote server
                ssh.update_playbook(playbook_name, new_content)

                # 2. Update the local cache so DB matches
                PlaybookCache.objects.update_or_create(
                    controller=controller,
                    name=playbook_name,
                    defaults={'content': new_content}
                )

                # 3. Update assignment metadata if provided
                if new_params:
                    import json
                    params_dict = json.loads(new_params) if isinstance(new_params, str) else new_params
                    PlaybookAssignment.objects.filter(
                        controller=controller,
                        playbook_name=playbook_name
                    ).update(input_parameters=params_dict)

                return Response({"message": "Playbook updated successfully!"})

            if request.method == 'DELETE':
                ssh.delete_playbook(playbook_name)
                # Cleanup DB cache and assignments
                PlaybookCache.objects.filter(controller=controller, name=playbook_name).delete()
                PlaybookAssignment.objects.filter(controller=controller, playbook_name=playbook_name).delete()
                return Response({"message": "Playbook deleted successfully!"})

        except Exception as e:
            return Response({"error": str(e)}, status=400)

class UserGroupViewSet(viewsets.ModelViewSet):
    queryset = UserGroup.objects.all()
    serializer_class = UserGroupSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    @action(detail=True, methods=['post'])
    def assign_playbook(self, request, pk=None):
        group = self.get_object()
        controller_id = request.data.get('controller_id')
        playbook_name = request.data.get('playbook_name')
        input_parameters = request.data.get('input_parameters', {}) # Receive JSON

        if not controller_id or not playbook_name:
            return Response({"error": "controller_id and playbook_name required"}, status=400)

        controller = AnsibleController.objects.get(id=controller_id)

        assignment, created = PlaybookAssignment.objects.update_or_create(
            group=group,
            controller=controller,
            playbook_name=playbook_name,
            defaults={'input_parameters': input_parameters}
        )
        assignment.input_parameters = input_parameters
        assignment.save()

        return Response({"status": "Assigned successfully"})

    @action(detail=True, methods=['post'])
    def remove_playbook(self, request, pk=None):
        group = self.get_object()
        controller_id = request.data.get('controller_id')
        playbook_name = request.data.get('playbook_name')

        PlaybookAssignment.objects.filter(
            group=group,
            controller_id=controller_id,
            playbook_name=playbook_name
        ).delete()
        return Response({"status": "Removed successfully"})

# --- NEW: VIEWSET FOR FRONTEND CACHED FETCHING ---
class PlaybookCacheViewSet(viewsets.ModelViewSet):
    queryset = PlaybookCache.objects.all()
    serializer_class = PlaybookCacheSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_queryset(self):
        controller_id = self.request.query_params.get('controller_id')
        if controller_id:
            return PlaybookCache.objects.filter(controller_id=controller_id)
        return super().get_queryset()

class MyTasksView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id: return Response({"error": "User ID is required"}, status=400)

        try:
            user = UserProfile.objects.get(id=user_id)
            groups = user.user_groups.all()
            assignments = PlaybookAssignment.objects.filter(group__in=groups).select_related('controller', 'group')

            tasks = []
            for a in assignments:
                tasks.append({
                    "assignment_id": a.id,
                    "playbook_name": a.playbook_name,
                    "group_name": a.group.name,
                    "controller_id": a.controller.id,
                    "controller_name": a.controller.name,
                    "controller_ip": a.controller.ip_address,
                    "input_parameters": a.input_parameters
                })
            return Response(tasks)
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

class RunTaskView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        assignment_id = request.data.get('assignment_id')
        extra_vars = request.data.get('extra_vars', {})
        # Get the user ID sending the request
        user_id = request.data.get('user_id') or request.query_params.get('user_id')

        if not assignment_id:
            return Response({"error": "Assignment ID required"}, status=400)

        # 1. Strictly validate the user
        log_user = UserProfile.objects.filter(id=user_id).first() if user_id else None
        if not log_user:
            return Response({"error": "Valid user_id is required for task execution."}, status=400)

        try:
            assignment = PlaybookAssignment.objects.get(id=assignment_id)
            ssh = AnsibleSSHClient(assignment.controller)

            # Pass extra_vars to the run_playbook method
            result = ssh.run_playbook(assignment.playbook_name, extra_vars=extra_vars)

            # 2. SAVE THE LOG with the correct user
            status_text = "Success" if result.get("status") == "success" else "Failed"
            TaskExecutionLog.objects.create(
                user=log_user,
                playbook_name=assignment.playbook_name,
                controller_name=assignment.controller.name,
                status=status_text,
                logs=result.get("logs", "No logs returned."),
                is_scheduled=False # It is a manual run
            )

            return Response(result)

        except PlaybookAssignment.DoesNotExist:
            return Response({"error": "Task assignment not found"}, status=404)
        except Exception as e:
            return Response({"status": "error", "logs": str(e)}, status=500)

class ScheduledTaskViewSet(viewsets.ModelViewSet):
    queryset = ScheduledTask.objects.all()
    serializer_class = ScheduledTaskSerializer
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        if user_id:
            return ScheduledTask.objects.filter(user_id=user_id)
        return super().get_queryset()
