import React, { useState, useEffect } from "react";
import { userAPI, authAPI } from "../services/api.js";
import {
  ClipboardCheck,
  Play,
  CheckCircle2,
  Globe,
  X,
  Terminal,
  Loader2,
  AlertCircle,
  Lock,
  Users
} from "lucide-react";

// 1. Added searchQuery to accept the search input from Dashboard
const UserTasks = ({ searchQuery = "" }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Execution Modal States
  const [showModal, setShowModal] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [logs, setLogs] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState("idle"); // idle, pin_verify, form_input, running, success, error
  const [showConsole, setShowConsole] = useState(true);

  // Dynamic parameter input states
  const [dynamicInputs, setDynamicInputs] = useState({});

  // Security Clearance PIN States
  const [verificationPin, setVerificationPin] = useState("");
  const [pinError, setPinError] = useState("");

  const fetchUserTasks = async () => {
    try {
      const currentUserId = sessionStorage.getItem("user_id");
      if (!currentUserId) {
        console.error("Security Context Missing: No user ID identified in tab session.");
        setLoading(false);
        return;
      }
      const res = await userAPI.getMyTasks(currentUserId);
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch isolated tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserTasks();
  }, []);

  const handleStartTaskClick = (task) => {
    setActiveTask(task);
    setVerificationPin("");
    setPinError("");
    setDynamicInputs({});
    setExecutionStatus("pin_verify");
    setShowConsole(true);
    setShowModal(true);
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setIsExecuting(true);
    setPinError("");

    const currentUserId = sessionStorage.getItem("user_id");
    if (!currentUserId) {
      setPinError("Security Context Missing: Session key expired. Please log in again.");
      setIsExecuting(false);
      return;
    }

    try {
      await authAPI.verifyPin(currentUserId, verificationPin);
      setIsExecuting(false);

      const fields = activeTask?.input_parameters?.fields || [];
      if (fields.length > 0) {
        setExecutionStatus("form_input");
      } else {
        executeAutomationTask(activeTask, {});
      }
    } catch (err) {
      setPinError("Authorization Denied: Invalid security PIN code.");
      setExecutionStatus("pin_verify");
      setIsExecuting(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeAutomationTask(activeTask, dynamicInputs);
  };

  const executeAutomationTask = async (task, variables) => {
    setIsExecuting(true);
    setExecutionStatus("running");
    setShowConsole(true);
    setLogs("Initializing Ansible environment...\nConnecting to managed node...");

    try {
      const res = await userAPI.runTask(task.assignment_id, {
        extra_vars: variables
      });

      if (res.data.status === "success") {
        setLogs(res.data.logs);
        setExecutionStatus("success");
        setShowConsole(false); // Hide console automatically on success
      } else {
        setLogs("ANSIBLE ERROR DETECTED:\n" + res.data.logs);
        setExecutionStatus("error");
        setShowConsole(true); // Keep console open on error so they can read what went wrong
      }
    } catch (err) {
      setLogs("CRITICAL ERROR: " + (err.response?.data?.logs || err.response?.data?.error || err.message));
      setExecutionStatus("error");
      setShowConsole(true);
    } finally {
      setIsExecuting(false);
      fetchUserTasks();
    }
  };

  const closeModal = () => {
    if (isExecuting) return;
    setShowModal(false);
    setExecutionStatus("idle");
    setLogs("");
    setVerificationPin("");
    setPinError("");
    setDynamicInputs({});
    setShowConsole(true);
  };

  // 2. Filter tasks based on the global search query
  const filteredTasks = tasks.filter(task => 
    task.playbook_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.controller_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.group_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 gap-2 font-medium">
        <Loader2 className="animate-spin text-brand-primary" size={20} />
        <span>Loading secure workspace...</span>
      </div>
    );
  }

  return (
    <div className="p-8 animate-in fade-in duration-500 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">My Work List</h1>
        <p className="text-slate-500 text-sm font-medium">Execute and monitor automation on assigned nodes</p>
      </div>

      <div className="space-y-4">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div key={task.assignment_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-cyan-500 transition-all">
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-xl bg-cyan-50 text-cyan-700 group-hover:scale-110 transition-transform">
                  <ClipboardCheck size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{task.playbook_name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Globe size={12} /> {task.controller_name} ({task.controller_ip})
                    </span>
                    <span className="flex items-center gap-1 border-l pl-4 border-slate-200">
                      <Users size={12} /> {task.group_name}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleStartTaskClick(task)}
                className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-slate-300"
              >
                <Play size={14} fill="currentColor" /> Run Now
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">No tasks found matching your search.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">

            <div className="p-6 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-white rounded-lg">
                  <Terminal size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">
                    {executionStatus === "pin_verify" && "Identity Security Authorization"}
                    {executionStatus === "form_input" && "Configure Runtime Parameters"}
                    {["running", "success", "error"].includes(executionStatus) && "Execution Console"}
                  </h2>
                  <p className="text-[10px] text-slate-500 uppercase font-black">{activeTask?.playbook_name}</p>
                </div>
              </div>
              {!isExecuting && (
                <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-6 bg-slate-900 flex-1 overflow-hidden flex flex-col relative justify-center min-h-[24rem]">

              {/* STEP A: PIN VERIFICATION */}
              {executionStatus === "pin_verify" && (
                <form onSubmit={handlePinSubmit} className="max-w-xs mx-auto text-center space-y-6 w-full animate-in fade-in duration-300">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-brand-primary mb-3 shadow-inner">
                      <Lock size={20} />
                    </div>
                    <p className="text-white text-xs font-black uppercase tracking-wider">Playbook Gate Clearance</p>
                    <p className="text-slate-400 text-[11px] mt-1 font-medium">Input your unique 6-digit profile PIN code to authenticate</p>
                  </div>

                  {pinError && (
                    <div className="p-3 bg-red-500/20 border-l-4 border-red-500 text-red-400 text-left text-[11px] font-bold rounded-r-xl">
                      {pinError}
                    </div>
                  )}

                  <input
                    type="password"
                    maxLength="6"
                    required
                    autoFocus
                    placeholder="••••••"
                    value={verificationPin}
                    className="w-full text-center text-3xl tracking-[0.6em] py-3 border-b-2 border-cyan-600 outline-none bg-transparent font-mono text-white placeholder:text-slate-800 focus:border-brand-primary transition-colors"
                    onChange={(e) => setVerificationPin(e.target.value)}
                  />

                  <div className="flex gap-3 pt-2">
                    <button type="button" disabled={isExecuting} onClick={closeModal} className="flex-1 py-3.5 border border-slate-700 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-xl uppercase tracking-widest transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={isExecuting || verificationPin.length !== 6} className="flex-1 bg-brand-primary hover:opacity-90 text-white font-bold text-xs rounded-xl uppercase tracking-widest transition-all disabled:opacity-50">
                      Authorize
                    </button>
                  </div>
                </form>
              )}

              {/* STEP B: DYNAMIC PARAMETERS INPUT FORM WORKSPACE */}
              {executionStatus === "form_input" && (
                <form onSubmit={handleFormSubmit} className="w-full space-y-4 max-w-xl mx-auto text-left flex flex-col justify-between h-full animate-in zoom-in-95 duration-200">
                  <div className="overflow-y-auto max-h-72 pr-1 space-y-4 custom-scrollbar">
                    {activeTask?.input_parameters?.fields?.map((field) => (
                      <div key={field.name} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-0.5">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type={field.type || "text"}
                          placeholder={field.placeholder || ""}
                          required={field.required}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition"
                          value={dynamicInputs[field.name] || ""}
                          onChange={(e) => setDynamicInputs({ ...dynamicInputs, [field.name]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-800 mt-auto flex-shrink-0">
                    <button type="button" onClick={closeModal} className="flex-1 py-3.5 border border-slate-700 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-xl uppercase tracking-widest transition-colors">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 bg-brand-primary hover:opacity-90 text-white font-bold text-xs rounded-xl uppercase tracking-widest transition-all">
                      Commit Task Execution
                    </button>
                  </div>
                </form>
              )}

              {/* STEP C: TERMINAL STREAM LAYOUT */}
              {["running", "success", "error"].includes(executionStatus) && (
                <div className="flex-1 flex flex-col h-full overflow-hidden w-full">

                  {/* UI IMPROVED: SUCCESS CARD */}
                  {executionStatus === "success" && (
                    <div className={`flex flex-col items-center justify-center bg-emerald-950/40 border border-emerald-500/20 p-10 rounded-[2rem] flex-shrink-0 text-center transition-all animate-in fade-in zoom-in duration-300 shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)] ${showConsole ? "mb-4" : ""}`}>
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                      </div>
                      <span className="text-base font-black text-emerald-50 mb-2 uppercase tracking-[0.15em]">Automation Completed Successfully</span>

                      <button
                        onClick={() => setShowConsole(!showConsole)}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all border border-white/5"
                      >
                        {showConsole ? "Hide Console Output" : "View Console Output"}
                      </button>
                    </div>
                  )}

                  {/* UI IMPROVED: ERROR CARD */}
                  {executionStatus === "error" && (
                    <div className={`flex flex-col items-center justify-center bg-red-950/40 border border-red-500/20 p-10 rounded-[2rem] flex-shrink-0 text-center transition-all animate-in fade-in zoom-in duration-300 shadow-[0_0_40px_-10px_rgba(239,68,68,0.15)] ${showConsole ? "mb-4" : ""}`}>
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                      </div>
                      <span className="text-base font-black text-red-50 mb-2 uppercase tracking-[0.15em]">Execution Unsuccessful</span>
                      <p className="text-xs text-red-200/60 mb-6 font-medium">The playbook encountered an error during execution. Please review the logs.</p>

                      <button
                        onClick={() => setShowConsole(!showConsole)}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all border border-white/5"
                      >
                        {showConsole ? "Hide Console Output" : "View Console Output"}
                      </button>
                    </div>
                  )}

                  {/* CONDITIONALLY RENDER THE BLACK TERMINAL WINDOW */}
                  {(showConsole || executionStatus === "running") && (
                    <div className="flex-1 overflow-y-auto font-mono text-[11px] text-emerald-400 leading-relaxed custom-scrollbar bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                      {executionStatus === "running" && (
                        <div className="flex items-center gap-2 mb-4 text-brand-primary animate-pulse">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="font-bold text-cyan-400">PARAGRINE ENGINE: RUNNING PLAYBOOK...</span>
                        </div>
                      )}
                      <pre className={`whitespace-pre-wrap ${executionStatus === "error" ? "text-red-400" : ""}`}>{logs || "Handshaking with system orchestrator..."}</pre>
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end flex-shrink-0">
              <button
                disabled={["pin_verify", "form_input"].includes(executionStatus) || isExecuting}
                onClick={closeModal}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs tracking-widest uppercase disabled:opacity-50 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                {isExecuting ? "Executing..." : "Close Console"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTasks;
