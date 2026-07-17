import React, { useState, useEffect } from "react";
import { adminAPI } from "../services/api.js";
import { FileCode, Server, RefreshCw, ChevronDown, Edit, Users, X, Save, Trash2 } from "lucide-react";

const Playbooks = ({ searchQuery = "" }) => {
  const [controllers, setControllers] = useState([]);
  const [selectedController, setSelectedController] = useState("");
  const [playbooks, setPlaybooks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activePlaybook, setActivePlaybook] = useState({ name: "", content: "", assigned_groups: [] });
  const [selectedGroup, setSelectedGroup] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [ctrlRes, groupRes] = await Promise.all([
          adminAPI.getControllers(),
          adminAPI.getGroups()
        ]);
        setControllers(ctrlRes.data);
        setGroups(groupRes.data);
        if (ctrlRes.data.length > 0) {
          setSelectedController(ctrlRes.data[0].id);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedController) return;

    // Use fast cached playbook endpoint
    const fetchPlaybooks = async () => {
      setLoading(true);
      try {
        const res = await adminAPI.getCachedPlaybooks(selectedController);
        setPlaybooks(res.data);
      } catch (err) {
        console.error("Failed to fetch cached playbooks", err);
        setPlaybooks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlaybooks();
  }, [selectedController]);

  // Actions
  const handleOpenEdit = async (playbookName) => {
    setActivePlaybook({ name: playbookName, content: "Loading...", input_parameters: "" });
    setIsEditModalOpen(true);
    try {
      const res = await adminAPI.getPlaybookDetails(selectedController, playbookName);
      setActivePlaybook({
        name: res.data.name,
        content: res.data.content,
        input_parameters: res.data.input_parameters ? JSON.stringify(res.data.input_parameters, null, 2) : ""
      });
    } catch (err) {
      setActivePlaybook({ name: playbookName, content: "Error loading file.", input_parameters: "" });
    }
  };

  const handleSavePlaybook = async () => {
    setSaving(true);
    try {
      let params = {};
      try {
        params = activePlaybook.input_parameters ? JSON.parse(activePlaybook.input_parameters) : {};
      } catch (e) {
        return alert("Invalid JSON in Input Configuration!");
      }

      await adminAPI.updatePlaybook(selectedController, activePlaybook.name, {
        content: activePlaybook.content,
        input_parameters: params
      });
      alert("Playbook and parameters saved successfully!");
      setIsEditModalOpen(false);
    } catch (err) {
      alert("Failed to save playbook.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlaybook = async (playbookName) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${playbookName} from the remote server?`)) return;

    try {
      await adminAPI.deletePlaybook(selectedController, playbookName);
      setPlaybooks(playbooks.filter(pb => pb.name !== playbookName));
    } catch (err) {
      alert("Failed to delete playbook: " + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenAssign = (playbook) => {
    setActivePlaybook({
      name: playbook.name,
      content: "",
      assigned_groups: playbook.assigned_groups || []
    });
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedGroup) return alert("Please select a group");
    setSaving(true);
    try {
      await adminAPI.assignPlaybookToGroup(selectedGroup, {
        controller_id: selectedController,
        playbook_name: activePlaybook.name
      });

      const groupObj = groups.find(g => g.id.toString() === selectedGroup.toString());
      setPlaybooks(playbooks.map(pb => {
        if (pb.name === activePlaybook.name) {
          const currentGroups = pb.assigned_groups || [];
          if (!currentGroups.includes(groupObj.name)) {
            return { ...pb, assigned_groups: [...currentGroups, groupObj.name] };
          }
        }
        return pb;
      }));

      alert(`Assigned ${activePlaybook.name} successfully!`);
      setIsAssignModalOpen(false);
      setSelectedGroup("");
    } catch (err) {
      alert("Failed to assign playbook.");
    } finally {
      setSaving(false);
    }
  };

  // Filter playbooks based on search input
  const filteredPlaybooks = playbooks.filter(pb =>
    pb.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Automation Functions</h1>
          <p className="text-slate-500 text-sm font-medium">Browse and execute automation scripts</p>
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm min-w-[250px]">
            <Server size={16} className="text-brand-primary" />
            <select
              value={selectedController}
              onChange={(e) => setSelectedController(e.target.value)}
              className="outline-none text-sm font-bold text-slate-700 bg-transparent cursor-pointer w-full appearance-none"
            >
              <option value="" disabled>Select a Controller...</option>
              {controllers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.ip_address})</option>
              ))}
            </select>
            <ChevronDown size={16} className="text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="animate-spin text-brand-primary" size={24} />
          <span className="text-sm font-bold uppercase tracking-widest">Loading Cached Data...</span>
        </div>
      ) : filteredPlaybooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaybooks.map((pb, index) => (
            <div key={index} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-brand-primary/30 transition-all flex flex-col h-full group">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-50 text-slate-500 rounded-2xl group-hover:bg-cyan-50 group-hover:text-brand-primary transition-colors">
                    <FileCode size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-800 break-all">{pb.name}</h3>

                    {/* YAML Script & Assigned Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">YAML Script</p>
                      {pb.assigned_groups && pb.assigned_groups.length > 0 && (
                        <span className="bg-brand-primary/10 text-brand-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Assigned
                        </span>
                      )}
                    </div>

                    {/* Group Name List */}
                    {pb.assigned_groups && pb.assigned_groups.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-2 font-medium bg-slate-50 inline-block px-2 py-1 rounded-lg">
                        Groups: <span className="text-slate-700">{pb.assigned_groups.join(', ')}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <button onClick={() => handleOpenEdit(pb.name)} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-cyan-50 rounded-lg transition" title="View/Edit Code">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleOpenAssign(pb)} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-cyan-50 rounded-lg transition" title="Assign to Group">
                    <Users size={16} />
                  </button>
                  <button onClick={() => handleDeletePlaybook(pb.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete Playbook">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileCode size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Playbooks Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {selectedController
              ? "We couldn't find any cached .yml files for this controller. Try pulling them from the Domains page!"
              : "Please add and select an Ansible Controller to view available playbooks."}
          </p>
        </div>
      )}

      {/* MODAL: EDIT PLAYBOOK */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-4xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileCode className="text-brand-primary" /> {activePlaybook.name}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-800"><X size={20}/></button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* YAML Editor */}
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase">YAML Content</label>
                <textarea
                  value={activePlaybook.content}
                  onChange={(e) => setActivePlaybook({ ...activePlaybook, content: e.target.value })}
                  className="flex-1 w-full p-4 bg-slate-900 text-cyan-400 font-mono text-sm rounded-xl outline-none resize-none"
                  spellCheck="false"
                />
              </div>

              {/* Input Configuration Editor */}
              <div className="w-1/3 flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-2 uppercase">Input Configuration (JSON)</label>
                <textarea
                  value={activePlaybook.input_parameters || ""}
                  placeholder='{"fields": [{"name": "var_name", "label": "Label", "type": "text", "required": true}]}'
                  onChange={(e) => setActivePlaybook({ ...activePlaybook, input_parameters: e.target.value })}
                  className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 text-slate-700 font-mono text-xs rounded-xl outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleSavePlaybook} disabled={saving} className="bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 flex items-center gap-2 shadow-lg shadow-slate-300 transition">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PLAYBOOK */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Assign Playbook</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-800"><X size={20}/></button>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700 mb-1">Target Playbook</p>
              <p className="text-sm text-slate-500 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">{activePlaybook.name}</p>
            </div>

            {/* Show currently assigned groups */}
            {activePlaybook.assigned_groups && activePlaybook.assigned_groups.length > 0 && (
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Currently Assigned To</p>
                <div className="flex flex-wrap gap-2">
                  {activePlaybook.assigned_groups.map((gName, i) => (
                    <span key={i} className="bg-cyan-50 text-cyan-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-cyan-100">
                      {gName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="text-sm font-bold text-slate-700 mb-2 block">Select User Group to Assign</label>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary appearance-none cursor-pointer text-sm"
                >
                  <option value="" disabled>Choose a group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={handleAssignSubmit}
              disabled={saving}
              className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 shadow-lg shadow-slate-300 transition flex justify-center items-center gap-2 mt-2"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : "Confirm Assignment"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Playbooks;
