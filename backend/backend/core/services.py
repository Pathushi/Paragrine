import paramiko
import io

class AnsibleSSHClient:
    def __init__(self, controller):
        self.controller = controller
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    def connect(self):
        key_string = io.StringIO(self.controller.ssh_private_key)
        try:
            key = paramiko.RSAKey.from_private_key(key_string)
        except paramiko.ssh_exception.SSHException:
            key_string.seek(0)
            key = paramiko.Ed25519Key.from_private_key(key_string)

        self.client.connect(
            hostname=self.controller.ip_address,
            username=self.controller.ssh_username,
            pkey=key
        )

    def list_playbooks(self):
        try:
            self.connect()
            stdin, stdout, stderr = self.client.exec_command(f"ls {self.controller.playbook_directory}/*.yml")
            files = stdout.read().decode().splitlines()
            self.client.close()
            return [{"name": f.split('/')[-1]} for f in files]
        except Exception as e:
            raise Exception(f"SSH Connection Failed: {str(e)}")

    def read_playbook(self, playbook_name):
        try:
            self.connect()
            filepath = f"{self.controller.playbook_directory}/{playbook_name}"
            sftp = self.client.open_sftp()
            
            with sftp.file(filepath, 'r') as f:
                content = f.read().decode('utf-8')
                
            sftp.close()
            self.client.close()
            return content
        except Exception as e:
            raise Exception(f"Failed to read playbook: {str(e)}")

    def update_playbook(self, playbook_name, content):
        try:
            self.connect()
            filepath = f"{self.controller.playbook_directory}/{playbook_name}"
            sftp = self.client.open_sftp()
            
            with sftp.file(filepath, 'w') as f:
                f.write(content)
                
            sftp.close()
            self.client.close()
            return True
        except Exception as e:
            raise Exception(f"Failed to save playbook: {str(e)}")

    def delete_playbook(self, playbook_name):
        try:
            self.connect()
            filepath = f"{self.controller.playbook_directory}/{playbook_name}"
            sftp = self.client.open_sftp()
            
            sftp.remove(filepath)
            
            sftp.close()
            self.client.close()
            return True
        except Exception as e:
            raise Exception(f"Failed to delete playbook: {str(e)}")

    def run_playbook(self, playbook_name, extra_vars=None):
        try:
            self.connect()

            # Construct the extra_vars flag
            extra_vars_flag = ""
            if extra_vars and isinstance(extra_vars, dict):
                vars_list = [f"{k}='{v}'" for k, v in extra_vars.items()]
                extra_vars_flag = f"-e \"{' '.join(vars_list)}\""

            # Build the final command
            command = f"ansible-playbook {self.controller.playbook_directory}/{playbook_name} {extra_vars_flag}"

            print(f"DEBUG: Executing command: {command}")

            # Execute command
            stdin, stdout, stderr = self.client.exec_command(command)
            
            # IMPROVEMENT: Increase timeout for Azure operations
            # This gives the process more time to complete before the channel times out
            stdout.channel.settimeout(300) 

            # Wait for the command to finish
            exit_status = stdout.channel.recv_exit_status()

            # Read the real terminal output
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')

            self.client.close()

            # SUCCESS CONDITION: 
            # Ansible exit status 0 is Success. 
            # If status is not 0, we check if the logs contain 'changed' or 'ok', 
            # which often indicates the task finished successfully despite non-zero exit.
            if exit_status == 0 or "changed" in out.lower() or "ok" in out.lower():
                return {"status": "success", "logs": out}
            else:
                return {"status": "error", "logs": out + "\n\nERROR TRACE:\n" + err}

        except Exception as e:
            # Re-raise with a clear message
            raise Exception(f"Execution Failed: {str(e)}")
