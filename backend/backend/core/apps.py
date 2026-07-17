from django.apps import AppConfig
import os

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Check if we are running in a management command context
        # This prevents the scheduler from starting during migrations or tests
        if os.environ.get('RUN_MAIN') or os.environ.get('PM2_INSTANCE_ID') or not os.environ.get('RUN_MAIN'):
            from .scheduler import start_scheduler
            # Only start if it hasn't been started yet (prevents double-runs)
            if not hasattr(self, 'scheduler_started'):
                start_scheduler()
                self.scheduler_started = True
