import logging
from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.jobstores import register_events
from django.utils import timezone
from datetime import timedelta

from .models import ScheduledTask, TaskExecutionLog
from .services import AnsibleSSHClient

# Configure logging so you can see if it's actually running in the logs
logger = logging.getLogger(__name__)

def check_and_run_tasks():
    # Use timezone-aware 'now'
    now = timezone.now()
    current_date = now.date()
    current_time = now.time().replace(second=0, microsecond=0) # Normalize to minutes
    current_day_name = now.strftime('%A').lower()

    tasks = ScheduledTask.objects.filter(is_active=True).select_related('user', 'assignment', 'assignment__controller')

    for task in tasks:
        # Normalize task time to minutes as well
        task_time = task.execution_time.replace(second=0, microsecond=0)

        if task_time == current_time:
            # Check recurrence
            should_run = False
            if task.recurrence == 'once' and task.execution_date <= current_date:
                should_run = True
            elif task.recurrence == 'daily':
                should_run = True
            elif task.recurrence == current_day_name:
                should_run = True

            if should_run:
                print(f"--- TRIGGERED: {task.assignment.playbook_name} ---")
                try:
                    ssh = AnsibleSSHClient(task.assignment.controller)
                    result = ssh.run_playbook(task.assignment.playbook_name, extra_vars=task.assignment.input_parameters)

                    status_text = "Success" if result.get("status") == "success" else "Failed"
                    TaskExecutionLog.objects.create(
                        user=task.user,
                        playbook_name=task.assignment.playbook_name,
                        controller_name=task.assignment.controller.name, # <-- ADDED FOR METRICS
                        status=status_text,
                        logs=result.get("logs", "No output"),
                        is_scheduled=True  # <-- ENSURES IT SHOWS ON THE CALENDAR
                    )
                except Exception as e:
                    TaskExecutionLog.objects.create(
                        user=task.user,
                        playbook_name=task.assignment.playbook_name,
                        controller_name=task.assignment.controller.name, # <-- ADDED FOR METRICS
                        status="Failed",
                        logs=f"Error: {str(e)}",
                        is_scheduled=True  # <-- ENSURES ERRORS SHOW ON THE CALENDAR TOO
                    )

                task.last_run = now
                if task.recurrence == 'once':
                    task.is_active = False
                task.save()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Ensure the jobstore is using your default database
    scheduler.add_jobstore(DjangoJobStore(), "default")

    # Add the job if it doesn't already exist
    scheduler.add_job(
        check_and_run_tasks,
        'interval',
        minutes=1,
        id="task_checker_job",
        replace_existing=True
    )

    # Register events to help with debugging
    register_events(scheduler)
    scheduler.start()
    print("--- SCHEDULER STARTED SUCCESSFULLY ---")
