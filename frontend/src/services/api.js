import axios from "axios";
import toast from "react-hot-toast";

const BASE_URL = "/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// AUTO-ATTACH TOKEN
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returns 401 Unauthorized, the session has expired
    if (error.response && error.response.status === 401) {
      sessionStorage.clear();
      toast.error("System has timed out. Please log in again.");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);
// ============================================================
// TASK ENDPOINTS
// ============================================================
const taskEndpoints = {
  getUserHistory: (userId) => api.get(`/tasks/user-history/?user_id=${userId}`),
  getAssignedTasks: (userId) => api.get(`/tasks/assignments/?user_id=${userId}`),
  assignTask: (data) => api.post("/tasks/assignments/", data),
};

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  getCaptcha: () => api.get("/auth/captcha/"),
  loginStepOne: (credentials) => api.post("/auth/login/", credentials),
  verifyPin: (userId, pin) => api.post("/auth/verify-pin/", { user_id: userId, pin }),
  forgotPassword: (data) => api.post("/auth/forgot-password/", data),
};

// ============================================================
// USER PROFILE API
// ============================================================
export const userProfileAPI = {
  getMyProfile: (userId) => api.get(`/users/me/?user_id=${userId}`),
  updateMyProfile: (userId, formData) => api.put(`/users/me/?user_id=${userId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ============================================================
// ADMIN API
// ============================================================
export const adminAPI = {
  getSystemStats: () => api.get("/auth/stats/"),
  getUsers: () => api.get("/users/"),
  createUser: (data) => api.post("/users/", data),
  deleteUser: (id) => api.delete(`/users/${id}/`),
  updateUser: (id, data) => api.put(`/users/${id}/`, data),
  toggleUserAccess: (id) => api.post(`/users/${id}/toggle_access/`),
  getGroups: () => api.get("/groups/"),
  createGroup: (data) => api.post("/groups/", data),
  updateGroup: (id, data) => api.put(`/groups/${id}/`, data),
  deleteGroup: (id) => api.delete(`/groups/${id}/`),
  assignPlaybookToGroup: (groupId, data) => api.post(`/groups/${groupId}/assign_playbook/`, data),
  assignTask: (data) => api.post("/tasks/assignments/", data),
  getScheduledTasks: () => api.get("/tasks/assignments/"),
  ...taskEndpoints,
  getControllers: () => api.get("/controllers/"),
  addController: (data) => api.post("/controllers/", data),
  updateController: (id, data) => api.put(`/controllers/${id}/`, data),
  deleteController: (id) => api.delete(`/controllers/${id}/`),
  syncPlaybooks: (id) => api.get(`/controllers/${id}/sync_playbooks/`),
  pullPlaybooks: (id) => api.post(`/controllers/${id}/pull_playbooks/`),
  getCachedPlaybooks: (id) => api.get(`/playbook-cache/?controller_id=${id}`),
  getPlaybookDetails: (id, name) => api.get(`/controllers/${id}/playbook-details/?name=${name}`),
  updatePlaybook: (id, name, data) => api.put(`/controllers/${id}/playbook-details/?name=${name}`, data),
  deletePlaybook: (id, name) => api.delete(`/controllers/${id}/playbook-details/?name=${name}`),
};

// ============================================================
// USER API (WITH USER ID INJECTION FIX)
// ============================================================
export const userAPI = {
  ...taskEndpoints,
  getMyTasks: (userId) => api.get(`/user/my-tasks/?user_id=${userId}`),

  runTask: (assignmentId, data) => {
    const userId = sessionStorage.getItem("user_id");
    return api.post(`/user/run-task/`, {
        assignment_id: assignmentId,
        user_id: userId,
        ...data
    });
},

  getScheduledTasks: (userId) => api.get(`/schedules/?user_id=${userId}`),
  scheduleTask: (data) => api.post(`/schedules/`, data),
  updateScheduledTask: (id, data) => api.put(`/schedules/${id}/`, data),
  deleteScheduledTask: (id) => api.delete(`/schedules/${id}/`),
};

export default api;
