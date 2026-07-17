import React, { useState, useEffect } from "react";
import { adminAPI } from "../services/api.js";
import {
  Users,
  Plus,
  X,
  Trash2,
  Edit3,
  Shield,
  UserCheck,
  Check,
} from "lucide-react";

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    selectedUsers: [],
  });

  const loadData = async () => {
    try {
      const [groupRes, userRes] = await Promise.all([
        adminAPI.getGroups(),
        adminAPI.getUsers(),
      ]);
      setGroups(groupRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error("Failed to sync structural group layout parameters.", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedGroupId(null);
    setFormData({ name: "", selectedUsers: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (group) => {
    setIsEditMode(true);
    setSelectedGroupId(group.id);
    setFormData({
      name: group.name,
      selectedUsers: group.users || [], // Array of integer IDs
    });
    setIsModalOpen(true);
  };

  const handleUserCheckboxChange = (userId) => {
    const updatedUsers = [...formData.selectedUsers];
    const index = updatedUsers.indexOf(userId);
    if (index > -1) {
      updatedUsers.splice(index, 1);
    } else {
      updatedUsers.push(userId);
    }
    setFormData({ ...formData, selectedUsers: updatedUsers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: formData.name,
      users: formData.selectedUsers,
    };

    try {
      if (isEditMode) {
        await adminAPI.updateGroup(selectedGroupId, payload);
      } else {
        await adminAPI.createGroup(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Mutation Error:", err.response?.data);
      alert("Operational issue saving access group parameters.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id, name) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently clear out group: "${name}"?`,
      )
    )
      return;
    try {
      await adminAPI.deleteGroup(id);
      loadData();
    } catch (err) {
      alert("Failed to drop permission node boundary.");
    }
  };

  return (
    <div className="p-8 animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Access Groups
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Group operators together and map organizational authorization tiers
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg active:scale-95 text-sm shadow-slate-300"
        >
          <Plus size={18} /> New Access Group
        </button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div
              key={group.id}
              className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group flex flex-col h-full hover:border-cyan-500/50 transition-all duration-200"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-50 text-brand-primary rounded-2xl">
                    <Users size={22} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openEditModal(group)}
                      className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-brand-primary hover:text-white transition border border-slate-100"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 bg-slate-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition border border-slate-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 text-lg tracking-tight mb-1">
                  {group.name}
                </h3>
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                  {group.users?.length || 0} Registered Members
                </span>

                {/* Sub-list displaying the member pills layout */}
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {group.user_details?.length > 0 ? (
                    group.user_details.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">
                          {u.username[0].toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {u.full_name}
                          </p>
                          <p className="text-[9px] font-medium text-slate-400 truncate">
                            {u.designation || "Operator"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">
                      No users bound to this group domain partition yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center text-slate-400 italic bg-white border border-slate-200 rounded-[2.5rem]">
            No permission clusters managed at this time. Create an access group
            to begin mapping users.
          </div>
        )}
      </div>

      {/* COMPACT INPUT MODAL BOX */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary text-white rounded-xl">
                  <Shield size={18} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  {isEditMode
                    ? "Modify Group Scope"
                    : "Initialize Access Group"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col overflow-hidden p-6"
            >
              <div className="space-y-4 flex-1 overflow-y-auto pr-1 pb-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">
                    Group Identifier Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operations Engineering Team"
                    value={formData.name}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">
                    Select Target Associates ({formData.selectedUsers.length})
                  </label>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto bg-slate-50/50">
                    {users.map((user) => {
                      const isChecked = formData.selectedUsers.includes(
                        user.id,
                      );
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleUserCheckboxChange(user.id)}
                          className={`flex items-center justify-between p-3 cursor-pointer select-none transition-colors ${
                            isChecked ? "bg-cyan-50/50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                                isChecked
                                  ? "bg-brand-primary text-white"
                                  : "bg-white border border-slate-200 text-slate-500"
                              }`}
                            >
                              {user.username[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-[10px] font-medium text-slate-400">
                                @{user.username} • {user.designation || "Staff"}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                              isChecked
                                ? "bg-brand-primary border-brand-primary text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 shadow-lg disabled:opacity-50 transition-all shadow-slate-300"
                >
                  {loading
                    ? "Saving Changes..."
                    : isEditMode
                      ? "Save Workspace"
                      : "Build Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
