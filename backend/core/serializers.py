from rest_framework import serializers
from .models import UserProfile, UserDevice, AnsibleController, UserGroup, PlaybookAssignment, ScheduledTask, PlaybookCache

# ============================================================
# USER PROFILE
# ============================================================

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'id', 'record_id', 'username', 'password', 'first_name', 'last_name',
            'email', 'designation', 'department', 'location', 'mobile',
            'supervisor_name', 'pin', 'is_enabled', 'is_staff', 'profile_picture'
        ]
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'email': {'required': False, 'allow_null': True},
            'department': {'required': False, 'allow_null': True},
            'location': {'required': False, 'allow_null': True},
            'mobile': {'required': False, 'allow_null': True},
            'supervisor_name': {'required': False, 'allow_null': True},
            'pin': {'required': False}
        }

    def validate_password(self, value):
        if not value:
            return value
        if len(value) < 4:
            raise serializers.ValidationError("Password must be at least 4 characters.")
        return value

    def create(self, validated_data):
        return UserProfile.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance

# ============================================================
# USER DEVICE
# ============================================================

class UserDeviceSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = UserDevice
        fields = '__all__'

class AnsibleControllerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnsibleController
        fields = '__all__'


class PlaybookAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaybookAssignment
        fields = '__all__'

class UserGroupSerializer(serializers.ModelSerializer):
    assigned_playbooks = PlaybookAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = UserGroup
        fields = ['id', 'name', 'users', 'assigned_playbooks']

class ScheduledTaskSerializer(serializers.ModelSerializer):
    # This pulls the playbook name from the related assignment so the frontend can display it
    playbook_name = serializers.ReadOnlyField(source='assignment.playbook_name')

    class Meta:
        model = ScheduledTask
        fields = '__all__'

# ============================================================
# NEW CACHE SERIALIZER
# ============================================================

class PlaybookCacheSerializer(serializers.ModelSerializer):
    controller_name = serializers.ReadOnlyField(source='controller.name')
    assigned_groups = serializers.SerializerMethodField()

    class Meta:
        model = PlaybookCache
        fields = '__all__'

    def get_assigned_groups(self, obj):
        assignments = PlaybookAssignment.objects.filter(
            controller=obj.controller,
            playbook_name=obj.name
        ).select_related('group')
        return [a.group.name for a in assignments]
