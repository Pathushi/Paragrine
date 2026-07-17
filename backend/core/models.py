from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.utils import timezone


class UserProfile(AbstractUser):
    record_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    designation = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    mobile = models.CharField(max_length=20)
    
    supervisor_name = models.CharField(max_length=100)
    supervisor_mobile = models.CharField(max_length=20)
    supervisor_location = models.CharField(max_length=100)
    
    pin = models.CharField(max_length=6)
    is_enabled = models.BooleanField(default=True)
    
    profile_picture = models.ImageField(upload_to='avatars/', null=True, blank=True)

class UserDevice(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='devices')
    visitor_id = models.CharField(max_length=64, db_index=True)
    os = models.CharField(max_length=50)
    browser = models.CharField(max_length=50)
    screen_resolution = models.CharField(max_length=30)
    timezone = models.CharField(max_length=50)
    canvas_hash = models.TextField()
    is_trusted = models.BooleanField(default=False)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.browser} on {self.os}"

class AnsibleController(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    ip_address = models.GenericIPAddressField()
    ssh_username = models.CharField(max_length=50)
    ssh_private_key = models.TextField()
    playbook_directory = models.CharField(max_length=255, default="/home/ubuntu/playbooks")
    is_connected = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
class UserGroup(models.Model):
    name = models.CharField(max_length=100, unique=True)
    users = models.ManyToManyField(UserProfile, related_name='user_groups', blank=True)

    def __str__(self):
        return self.name

class PlaybookAssignment(models.Model):
    group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, related_name='assigned_playbooks')
    controller = models.ForeignKey(AnsibleController, on_delete=models.CASCADE)
    playbook_name = models.CharField(max_length=255)
    input_parameters = models.JSONField(default=dict, blank=True, null=True)

    class Meta:
        unique_together = ('group', 'controller', 'playbook_name')

    def __str__(self):
        return f"{self.playbook_name} assigned to {self.group.name}"

class ScheduledTask(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    assignment = models.ForeignKey(PlaybookAssignment, on_delete=models.CASCADE)
    execution_date = models.DateField()
    execution_time = models.TimeField()
    # Stores: 'once', 'daily', 'monday', 'tuesday', etc.
    recurrence = models.CharField(max_length=20, default='once') 
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.assignment.playbook_name} - {self.recurrence}"

class TaskExecutionLog(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    playbook_name = models.CharField(max_length=255)
    
    # --- NEW FIELD ---
    controller_name = models.CharField(max_length=100, null=True, blank=True) 
    
    status = models.CharField(max_length=50) # 'Success' or 'Failed'
    logs = models.TextField()
    execution_time = models.DateTimeField(auto_now_add=True)
    is_scheduled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.playbook_name} - {self.status} at {self.execution_time}"


class PlaybookCache(models.Model):
    controller = models.ForeignKey(AnsibleController, on_delete=models.CASCADE, related_name='cached_playbooks')
    name = models.CharField(max_length=255)
    content = models.TextField()
    last_pulled = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('controller', 'name')

    def __str__(self):
        return f"{self.name} ({self.controller.name})"
