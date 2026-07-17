import React, { useState, useEffect } from "react";
import { adminAPI } from "../services/api.js";
import {
  UserPlus,
  User,
  Search,
  X,
  Trash2,
  Edit3,
  UserCog,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    designation: "",
    pin: "",
    is_staff: false,
  });

  const loadUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleAccess = async (user) => {
    const currentLoggedInId = sessionStorage.getItem("user_id");
    if (user.id.toString() === currentLoggedInId) {
      alert(
        "Security Protocol: You cannot revoke your own administrative access.",
      );
      return;
    }

    try {
      await adminAPI.toggleUserAccess(user.id);
      loadUsers();
    } catch (err) {
      console.error("Toggle failed", err);
      alert("System Error: Failed to update user status.");
    }
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      username: "",
      password: "",
      first_name: "",
      last_name: "",
      designation: "",
      pin: "",
      is_staff: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setIsEditMode(true);
    setSelectedUserId(user.id);
    setFormData({
      username: user.username,
      password: "",
      first_name: user.first_name,
      last_name: user.last_name,
      designation: user.designation,
      pin: user.pin,
      is_staff: user.is_staff,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      username: formData.username,
      first_name: formData.first_name,
      last_name: formData.last_name,
      designation: formData.designation,
      pin: formData.pin,
      is_staff: formData.is_staff,
      is_enabled: true,
      record_id: `USR-${Date.now()}`,
      email: `${formData.username}@paragrine.local`,
    };

    if (!isEditMode) payload.password = formData.password;

    try {
      if (isEditMode) {
        await adminAPI.updateUser(selectedUserId, payload);
      } else {
        await adminAPI.createUser(payload);
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err) {
      console.error("Save Error:", err.response?.data);
      alert(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure? This action cannot be undone.")) return;
    try {
      await adminAPI.deleteUser(id);
      loadUsers();
    } catch (err) {
      alert("Delete failed");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-8 animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Access Control
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Manage team members and website access status
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all w-64 shadow-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg active:scale-95 text-sm shadow-slate-300"
          >
            <UserPlus size={18} /> Add Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Identity
              </th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Role
              </th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
                Web Access
              </th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.map((u) => (
              <tr
                key={u.id}
                className={`hover:bg-slate-50/50 transition-colors group ${!u.is_enabled ? "opacity-50" : ""}`}
              >
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                        !u.is_enabled
                          ? "bg-slate-100 text-slate-400"
                          : "bg-cyan-50 text-brand-primary"
                      }`}
                    >
                      <User size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-base">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        @{u.username} • {u.designation || "Staff"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2">
                    {u.is_staff ? (
                      <ShieldCheck size={14} className="text-cyan-700" />
                    ) : (
                      <User size={14} className="text-slate-400" />
                    )}
                    <span
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        u.is_staff
                          ? "bg-cyan-50 text-cyan-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.is_staff ? "Administrator" : "Team Member"}
                    </span>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => handleToggleAccess(u)}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${
                        u.is_enabled ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
                          u.is_enabled ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                    <span
                      className={`text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 ${
                        u.is_enabled ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {u.is_enabled ? (
                        <>
                          <ShieldCheck size={10} /> Active
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={10} /> Revoked
                        </>
                      )}
                    </span>
                  </div>
                </td>
                <td className="p-6 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-2.5 text-slate-300 hover:text-brand-primary hover:bg-cyan-50 rounded-xl transition-all"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL SECTION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary text-white rounded-xl">
                  <UserCog size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  {isEditMode ? "Modify Account" : "New User Account"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.first_name}
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.last_name}
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
              </div>
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                required
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
              {!isEditMode && (
                <input
                  type="password"
                  placeholder="System Password"
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Designation"
                  value={formData.designation}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                />
                <input
                  type="text"
                  maxLength="6"
                  placeholder="6-Digit PIN"
                  value={formData.pin}
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-mono focus:ring-2 focus:ring-brand-primary transition-all"
                  onChange={(e) =>
                    setFormData({ ...formData, pin: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_staff}
                  className="w-5 h-5 rounded-lg accent-cyan-700"
                  onChange={(e) =>
                    setFormData({ ...formData, is_staff: e.target.checked })
                  }
                />
                <span className="text-sm font-bold text-slate-700">
                  Grant Administrative Privileges
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-300 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading
                  ? "Processing..."
                  : isEditMode
                    ? "Update Changes"
                    : "Generate Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
