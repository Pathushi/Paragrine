import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { userAPI } from "../services/api.js";
import toast from "react-hot-toast";
import {
  Clock, Calendar as CalIcon, Plus, X, RefreshCw, Zap, Trash2, Edit3, Activity,
} from "lucide-react";

const UserCalendar = () => {
  const [date, setDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null); 

  const [availableTasks, setAvailableTasks] = useState([]);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [newTask, setNewTask] = useState({
    assignment_id: "",
    time: "",
    recurrence: "once",
  });

  const currentUserId = sessionStorage.getItem("user_id");

  const loadDashboardData = async () => {
    if (!currentUserId || currentUserId === "undefined") return;

    try {
      const tasksRes = await userAPI.getMyTasks(currentUserId);
      setAvailableTasks(tasksRes.data || []);

      const schedRes = await userAPI.getScheduledTasks(currentUserId);
      const transformedSchedules = (schedRes.data || []).map((task) => {
        const [year, month, day] = task.execution_date.split("-");
        const sanitizedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        return {
          id: task.id,
          title: task.playbook_name,
          time: task.execution_time,
          date: sanitizedDate.toDateString(),
          recurrence: task.recurrence,
          is_active: task.is_active,
        };
      });
      setScheduledTasks(transformedSchedules);

      const histRes = await userAPI.getUserHistory(currentUserId);
      setExecutionLogs(histRes.data || []);
    } catch (err) {
      console.error("Failed to load calendar data", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => loadDashboardData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!newTask.assignment_id || !newTask.time) return;
    setLoading(true);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const payload = {
      user: currentUserId,
      assignment: newTask.assignment_id,
      execution_date: `${year}-${month}-${day}`,
      execution_time: newTask.time,
      recurrence: newTask.recurrence,
      is_active: true,
    };

    try {
      if (isEditMode && selectedTaskId) {
        await userAPI.updateScheduledTask(selectedTaskId, payload);
        toast.success("Schedule updated successfully");
      } else {
        await userAPI.scheduleTask(payload);
        toast.success("Task added to queue");
      }
      setIsModalOpen(false);
      loadDashboardData();
    } catch (err) {
      toast.error("Error saving schedule.");
    } finally {
      setLoading(false);
    }
  };

  const removeTask = async (id) => {
    if (!window.confirm("Delete this scheduled task?")) return;
    try {
      await userAPI.deleteScheduledTask(id);
      toast.success("Schedule deleted");
      loadDashboardData();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const openEditModal = (task) => {
    setIsEditMode(true);
    setSelectedTaskId(task.id);
    setNewTask({
      assignment_id: task.assignment || "",
      time: task.time,
      recurrence: task.recurrence,
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setIsEditMode(false);
    setIsModalOpen(true);
    setNewTask({ assignment_id: "", time: "", recurrence: "once" });
  };

  const filteredTasks = scheduledTasks.filter((task) => task.is_active === true);

  const filteredActivities = executionLogs.filter((log) => {
    const logDateStr = new Date(log.date).toDateString();
    return logDateStr === date.toDateString();
  });

  return (
    <div className="p-8 fade-in font-sans relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Work Schedule</h1>
          <p className="text-slate-500 text-sm font-medium">Automate your routine tasks</p>
        </div>
        <button onClick={openNewModal} className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-2xl font-bold hover:opacity-90 shadow-lg text-sm shadow-slate-300">
          <Plus size={18} /> Schedule Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <Calendar onChange={setDate} value={date} className="w-full border-none" />
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[450px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-cyan-50 text-cyan-700 rounded-2xl"><CalIcon size={20} /></div>
            <div>
              <h3 className="font-bold text-slate-800">Queue Planning</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{date.toDateString()}</p>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[220px] mb-6 border-b pb-4 border-slate-100">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div key={task.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 group">
                  <div className={`w-1 h-8 rounded-full ${task.recurrence !== "once" ? "bg-cyan-600" : "bg-emerald-500"}`}></div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">{task.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium"><Clock size={10} /> {task.time}</span>
                      <span className="text-[10px] text-cyan-700 flex items-center gap-1 font-bold uppercase tracking-tighter">
                        {task.recurrence === "once" ? <Zap size={8} /> : <RefreshCw size={8} />} {task.recurrence}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(task)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-brand-primary transition-all"><Edit3 size={14} /></button>
                    <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-[11px] italic text-center py-4">No routines scheduled.</p>
            )}
          </div>

          {/* History Activities Logs Feed */}
          <div className="flex flex-col flex-1 min-h-[180px]">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs mb-3">
              <Activity size={14} className="text-slate-400" />
              <h4>Execution History Logs</h4>
            </div>
            <div className="space-y-2.5 overflow-y-auto flex-1 max-h-[180px]">
              {filteredActivities.length > 0 ? (
                filteredActivities.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)} 
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:border-brand-primary transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${log.status === "Success" ? "bg-emerald-500" : "bg-red-500"}`}></div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{log.playbook}</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">{log.time}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${log.status === "Success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {log.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed rounded-2xl border-slate-200 p-6 opacity-40">
                  <Clock size={24} className="text-slate-400 mb-1" />
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Idle Pipeline</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md animate-in zoom-in overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold tracking-tight text-slate-800">{isEditMode ? "Modify Schedule" : "Schedule Task"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Select Playbook</label>
                <select
                  required
                  value={newTask.assignment_id}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none"
                  onChange={(e) => setNewTask({ ...newTask, assignment_id: e.target.value })}
                >
                  <option value="" disabled>Choose Automation...</option>
                  {availableTasks.map((task) => (
                    <option key={task.assignment_id} value={task.assignment_id}>{task.playbook_name} - ({task.controller_name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Time</label>
                  <input type="time" required value={newTask.time} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" onChange={(e) => setNewTask({ ...newTask, time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Frequency</label>
                  <select
                    value={newTask.recurrence}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold appearance-none"
                    onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value })}
                  >
                    <option value="once">Run Once</option>
                    <option value="daily">Every Day</option>
                    <option value="monday">Every Monday</option>
                    <option value="tuesday">Every Tuesday</option>
                    <option value="wednesday">Every Wednesday</option>
                    <option value="thursday">Every Thursday</option>
                    <option value="friday">Every Friday</option>
                    <option value="saturday">Every Saturday</option>
                    <option value="sunday">Every Sunday</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 shadow-xl transition-all disabled:opacity-50">
                {loading ? "Syncing..." : isEditMode ? "Update Changes" : "Confirm Schedule"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RAW LOG VIEWER MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-white font-bold text-sm">Execution Terminal Logs</h3>
                <p className="text-slate-400 text-xs">{selectedLog.playbook} • {selectedLog.date} at {selectedLog.time}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <pre className={`text-[11px] font-mono whitespace-pre-wrap ${selectedLog.status === 'Success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {selectedLog.full_logs}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserCalendar;
