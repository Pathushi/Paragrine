import React, { useState, useEffect } from "react";
import { adminAPI } from "../services/api.js";
import { Server, Plus, X, Shield, Trash2, Key, Folder, Edit2, MapPin, AlignLeft, DownloadCloud } from "lucide-react";

const Controllers = ({ searchQuery = "" }) => {
  const [controllers, setControllers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    name: "",
    description: "",
    location: "",
    ip_address: "",
    ssh_username: "",
    ssh_private_key: "",
    playbook_directory: ""
  };
  const [formData, setFormData] = useState(initialFormState);

  const loadControllers = async () => {
    try {
      const res = await adminAPI.getControllers();
      setControllers(res.data);
    } catch (err) {
      console.error("Failed to fetch controllers", err);
    }
  };

  useEffect(() => {
    loadControllers();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (controller) => {
    setEditingId(controller.id);
    setFormData({
      name: controller.name,
      description: controller.description || "",
      location: controller.location || "",
      ip_address: controller.ip_address,
      ssh_username: controller.ssh_username,
      ssh_private_key: controller.ssh_private_key,
      playbook_directory: controller.playbook_directory
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await adminAPI.deleteController(id);
      setControllers(controllers.filter(c => c.id !== id));
    } catch (err) {
      alert("Failed to delete controller.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await adminAPI.updateController(editingId, formData);
      } else {
        await adminAPI.addController(formData);
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      loadControllers();
    } catch (err) {
      alert(`Failed to ${editingId ? "update" : "add"} controller.`);
    } finally {
      setLoading(false);
    }
  };

  // Pull Playbooks Action
  const pullPlaybooks = async (id) => {
    setLoading(true);
    try {
      const res = await adminAPI.pullPlaybooks(id);
      alert(res.data.message);
    } catch (err) {
      alert("Pull failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredControllers = controllers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ip_address.includes(searchQuery)
  );

  return (
    <div className="p-8 animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Automation Domains</h1>
          <p className="text-slate-500 text-sm font-medium">Manage remote infrastructure nodes</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 flex items-center gap-2 shadow-lg shadow-slate-300 transition active:scale-95"
        >
          <Plus size={18} /> Add Automation Domains
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredControllers.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-brand-primary/30 transition-all flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-cyan-50 text-brand-primary rounded-2xl"><Server size={22} /></div>
              
              {/* Action Icons are now always visible */}
              <div className="flex gap-1">
                <button onClick={() => pullPlaybooks(c.id)} disabled={loading} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-cyan-50 rounded-lg transition disabled:opacity-50" title="Pull Automation Functions">
                  <DownloadCloud size={16} className={loading ? "animate-pulse" : ""} />
                </button>
                <button onClick={() => openEditModal(c)} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-cyan-50 rounded-lg transition" title="Edit"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>

            <h3 className="font-bold text-lg text-slate-800 mb-1">{c.name}</h3>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">
              <MapPin size={12} className="text-brand-primary" />
              {c.location || "Location Undefined"}
            </div>
            <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
              {c.description || "No operational description provided for this infrastructure node."}
            </p>
            <p className="text-xs font-mono text-slate-400 mb-4 bg-slate-50 p-2 rounded-lg">{c.ip_address}</p>
            <div className="flex gap-2 text-[10px] font-black uppercase text-slate-400">
               <span className="flex items-center gap-1"><Shield size={12}/> {c.ssh_username}</span>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">{editingId ? "Edit Automation Domain" : "Add New Automation Domain"}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800"><X size={20}/></button>
            </div>

            {/* General Info Section */}
            <div className="space-y-3">
              <input
                type="text"
                value={formData.name}
                placeholder="Automation Domain Name (e.g., AWS Production)"
                required
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium"
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-primary transition-all">
                <MapPin size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={formData.location}
                  placeholder="Physical/Cloud Location (e.g., us-east-1)"
                  className="bg-transparent w-full text-sm outline-none placeholder:text-slate-400 font-medium"
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
              <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-primary transition-all">
                <AlignLeft size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <textarea
                  rows="2"
                  value={formData.description}
                  placeholder="Operational description or context..."
                  className="bg-transparent w-full text-sm outline-none placeholder:text-slate-400 font-medium resize-none"
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connection Parameters</label>

                <input
                  type="text"
                  value={formData.ip_address}
                  placeholder="IP Address (e.g., 54.12.34.56)"
                  required
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-mono text-sm"
                  onChange={e => setFormData({...formData, ip_address: e.target.value})}
                />
                <input
                  type="text"
                  value={formData.ssh_username}
                  placeholder="SSH Username (e.g., ubuntu)"
                  required
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium"
                  onChange={e => setFormData({...formData, ssh_username: e.target.value})}
                />
            </div>

            <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authentication & Paths</label>

                <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-primary transition-all">
                    <Key size={16} className="text-slate-400 mt-1 shrink-0"/>
                    <textarea
                      required
                      rows="4"
                      value={formData.ssh_private_key}
                      placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                      className="bg-transparent w-full text-xs outline-none placeholder:text-slate-300 font-mono resize-y"
                      onChange={e => setFormData({...formData, ssh_private_key: e.target.value})}
                    />
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-primary transition-all">
                    <Folder size={16} className="text-slate-400 shrink-0"/>
                    <input
                      type="text"
                      required
                      value={formData.playbook_directory}
                      placeholder="/home/ubuntu/playbooks"
                      className="bg-transparent w-full text-sm outline-none placeholder:text-slate-400 font-medium"
                      onChange={e => setFormData({...formData, playbook_directory: e.target.value})}
                    />
                </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 shadow-lg shadow-slate-300 transition-all">{loading ? "Saving..." : (editingId ? "Update Domain" : "Add Domain")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Controllers;
