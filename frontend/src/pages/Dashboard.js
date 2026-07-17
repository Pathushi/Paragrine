import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Server, LogOut, History, FileCode, Calendar as CalIcon,
  Activity, Users, Clock, CheckCircle2, Cpu, UserCheck, ClipboardList,
  User, X, Camera, AlertCircle, PieChart as PieChartIcon, BarChart2, Search, Menu
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";
import toast from "react-hot-toast";
import { adminAPI, userProfileAPI, userAPI } from "../services/api.js";
import Controllers from "./Controllers.js";
import Playbooks from "./Playbooks.js";
import UserTasks from "./UserTasks.js";
import UserCalendar from "./UserCalendar.js";
import UserManagement from "./UserManagement.js";
import GroupManagement from "./GroupManagement.js";

const Dashboard = () => {
  const role = sessionStorage.getItem("user_role");
  const currentUserId = sessionStorage.getItem("user_id");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });

  useEffect(() => {
    let timeout;
    const logoutUser = () => {
      sessionStorage.clear();
      toast.error("System has timed out due to inactivity. Please log in again.");
      window.location.href = "/";
    };
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(logoutUser, 3600000);
    };
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timeout);
    };
  }, []);

  const [activeView, setActiveView] = useState(role === "admin" ? "overview" : "user-overview");
  const [selectedLog, setSelectedLog] = useState(null);

  const [stats, setStats] = useState({
    total_controllers: 0,
    active_users: 0,
    success_rate: "0%",
    recent_activity: [],
    controller_utilization: [],
  });

  const [userStats, setUserStats] = useState({
    total_assigned: 0,
    completed_today: [],
    failed_today: [],
    raw_user_history: [],
  });

  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userFullName, setUserFullName] = useState("Loading...");
  const [profileData, setProfileData] = useState({
    first_name: "", last_name: "", designation: "", email: "", mobile: "", preview_url: "", file_obj: null,
  });

  const loadProfileTelemetry = async () => {
    if (!currentUserId) return;
    try {
      const res = await userProfileAPI.getMyProfile(currentUserId);
      const data = res.data;
      setProfileData({
        first_name: data.first_name || "", last_name: data.last_name || "", designation: data.designation || "",
        email: data.email || "", mobile: data.mobile || "", preview_url: data.profile_picture || "", file_obj: null,
      });
      const calculatedFullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      setUserFullName(calculatedFullName === "" ? data.username : calculatedFullName);
    } catch (err) {
      console.error("Profile telemetry sync failed", err);
    }
  };

  useEffect(() => {
    loadProfileTelemetry();
  }, [currentUserId]);

  useEffect(() => {
    const fetchMetricsEngine = async () => {
      setTelemetryLoading(true);
      try {
        if (role === "admin" && activeView === "overview") {
          const res = await adminAPI.getSystemStats();
          setStats({
            total_controllers: res.data.total_controllers || 0,
            active_users: res.data.active_users || 0,
            success_rate: res.data.success_rate || "0%",
            recent_activity: res.data.recent_activity || [],
            controller_utilization: res.data.controller_utilization || []
          });
        } else if (role !== "admin" && activeView === "user-overview") {
          const [assignRes, histRes] = await Promise.all([
            userAPI.getMyTasks(currentUserId),
            userAPI.getUserHistory(currentUserId)
          ]);
          const rawAssignments = assignRes.data || [];
          const rawLogs = histRes.data || [];

          const todayISOStr = new Date().toISOString().split("T")[0];
          const completedToday = rawLogs.filter(log => log.date === todayISOStr && log.status === "Success");
          const failedToday = rawLogs.filter(log => log.date === todayISOStr && log.status === "Failed");

          setUserStats({
            total_assigned: rawAssignments.length,
            completed_today: completedToday,
            failed_today: failedToday,
            raw_user_history: rawLogs,
          });
        }
      } catch (err) {
        console.error("Telemetry sync module failed", err);
      } finally {
        setTelemetryLoading(false);
      }
    };
    fetchMetricsEngine();
  }, [activeView, role, currentUserId]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/";
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("first_name", profileData.first_name);
    formData.append("last_name", profileData.last_name);
    formData.append("designation", profileData.designation);
    formData.append("email", profileData.email);
    formData.append("mobile", profileData.mobile);

    if (profileData.file_obj) {
      const fileExtension = profileData.file_obj.name.split('.').pop();
      formData.append("profile_picture", profileData.file_obj, `avatar_${currentUserId}.${fileExtension}`);
    }

    try {
      await userProfileAPI.updateMyProfile(currentUserId, formData);
      setIsProfileModalOpen(false);
      loadProfileTelemetry();
      toast.success("System Profile configuration synchronized completely!");
    } catch (err) {
      console.error(err);
      toast.error("Operational issue executing identity updates.");
    }
  };

  const CHART_COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];

  const activePlaybooksData = useMemo(() => {
    const counts = {};
    stats.recent_activity.forEach(log => {
      counts[log.playbook] = (counts[log.playbook] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [stats.recent_activity]);

  const controllerUtilizationData = stats.controller_utilization;

  const userWeeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        dateStr: d.toISOString().split("T")[0],
        day: days[d.getDay()],
        Scheduled: 0,
        Manual: 0
      };
    }).reverse();

    userStats.raw_user_history.forEach(log => {
      const dayObj = last7Days.find(d => d.dateStr === log.date);
      if (dayObj) {
        if (log.is_scheduled) dayObj.Scheduled += 1;
        else dayObj.Manual += 1;
      }
    });
    return last7Days;
  }, [userStats.raw_user_history]);

  const userReliabilityData = useMemo(() => {
    const totalToday = userStats.completed_today.length + userStats.failed_today.length;
    const reliability = totalToday === 0 ? 0 : Math.round((userStats.completed_today.length / totalToday) * 100);
    return [
      { name: "Success", value: reliability, fill: "#10b981" },
      { name: "Failure/Empty", value: 100 - reliability, fill: "#f1f5f9" }
    ];
  }, [userStats.completed_today, userStats.failed_today]);

  const renderOverview = () => {
    const filteredRecentActivity = stats.recent_activity.filter(log =>
      log.playbook.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="animate-in fade-in duration-500 pb-10">
        <div className="mb-8">
          <h1 className="font-bold uppercase text-[10px] tracking-[0.2em] theme-text-faint mb-1">OVERVIEW</h1>
          <h2 className="text-3xl font-bold theme-text-main tracking-tight">System Overview</h2>
          <p className="theme-text-muted text-sm font-medium mt-1">Real-time infrastructure telemetry</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard icon={<Server size={20} />} label="Total Automation Domains" value={stats.total_controllers} color="blue" sub="Connected Nodes" />
          <MetricCard icon={<Users size={20} />} label="Active Users" value={stats.active_users} color="emerald" sub="Enabled Operator Accounts" />
          <MetricCard icon={<Activity size={20} />} label="Success Rate" value={stats.success_rate} color="slate" sub="Percentage of Executed Jobs" pulse />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="theme-card p-6 rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon size={18} className="text-brand-primary" />
              <h3 className="font-bold theme-text-main">Most Active Playbooks</h3>
            </div>
            <div className="flex-1 min-h-[250px] w-full relative">
              {activePlaybooksData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={activePlaybooksData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {activePlaybooksData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--theme-text-muted)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center theme-text-faint text-xs font-bold uppercase">No Data Available</div>
              )}
            </div>
          </div>

          <div className="theme-card p-6 rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-brand-primary" />
              <h3 className="font-bold theme-text-main">Controller Utilization</h3>
            </div>
            <div className="flex-1 min-h-[250px] w-full relative">
               {controllerUtilizationData && controllerUtilizationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={controllerUtilizationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--theme-text-faint)', fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--theme-text-faint)', fontWeight: 'bold'}} />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="tasks" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center theme-text-faint text-xs font-bold uppercase">No Data Available</div>
               )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-6">
            <History size={18} className="theme-text-faint" />
            <h3 className="font-bold theme-text-main">Recent Activity</h3>
          </div>

          <div className="theme-card rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-10">
            <div className="p-4 space-y-3">
              {filteredRecentActivity.length > 0 ? (
                filteredRecentActivity.map((log) => (
                  <div key={log.id} onClick={() => setSelectedLog(log)} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:border-brand-primary transition-all duration-300 gap-3 sm:gap-0">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${log.status === "Success" ? "bg-emerald-500" : "bg-red-500"}`}></div>
                      <div>
                        <p className="text-sm font-bold theme-text-main">{log.playbook} <span className="theme-text-muted font-medium ml-2">by {log.user}</span></p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={10} className="theme-text-faint" />
                          <p className="text-[10px] theme-text-faint uppercase font-black tracking-widest">{log.date} • {log.time}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`w-fit text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${log.status === "Success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {log.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center"><Clock size={40} className="mx-auto theme-text-faint mb-4" /><p className="theme-text-faint text-xs font-black uppercase tracking-[0.2em]">No Recent Task Executions</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUserOverview = () => {
    const filteredRawHistory = userStats.raw_user_history.filter(log =>
      log.playbook.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const scheduledActivities = filteredRawHistory.filter((log) => log.is_scheduled === true);
    const manualActivities = filteredRawHistory.filter((log) => log.is_scheduled === false);

    return (
      <div className="animate-in fade-in duration-500 pb-10">
        <div className="mb-8">
          <h1 className="font-bold uppercase text-[10px] tracking-[0.2em] theme-text-faint mb-1">USER-OVERVIEW</h1>
          <h2 className="text-3xl font-bold theme-text-main tracking-tight">My Workspace Analytics</h2>
          <p className="theme-text-muted text-sm font-medium mt-1">Daily telemetry queue orchestration mapping</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard icon={<ClipboardList size={20} />} label="Total Tasks" value={userStats.total_assigned} color="blue" sub="Assigned to you" />
          <MetricCard icon={<CheckCircle2 size={20} />} label="Successed Jobs Today" value={userStats.completed_today.length} color="emerald" sub="Executed OK on Nodes" />
          <MetricCard icon={<AlertCircle size={20} />} label="Failed Today" value={userStats.failed_today.length} color="slate" sub="Requires attention" pulse={userStats.failed_today.length > 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="theme-card p-6 rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-brand-primary" />
              <h3 className="font-bold theme-text-main">Daily Activity Breakdown</h3>
            </div>
            <div className="flex-1 min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--theme-text-faint)', fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--theme-text-faint)', fontWeight: 'bold'}} allowDecimals={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--theme-text-muted)' }} />
                  <Bar dataKey="Scheduled" stackId="a" fill="#0ea5e9" barSize={35} />
                  <Bar dataKey="Manual" stackId="a" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="theme-card p-6 rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Activity size={18} className="text-emerald-500" />
              <h3 className="font-bold theme-text-main">Personal Job Reliability</h3>
            </div>
            <div className="flex-1 min-h-[220px] w-full relative z-10 flex flex-col items-center justify-end pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userReliabilityData}
                    cx="50%"
                    cy="80%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={80}
                    outerRadius={110}
                    dataKey="value"
                    stroke="none"
                  >
                    {userReliabilityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute bottom-6 flex flex-col items-center">
                <span className="text-4xl font-black theme-text-main">{userReliabilityData[0].value}%</span>
                <span className="text-[10px] font-bold theme-text-faint uppercase tracking-widest mt-1">Success Rate Today</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 font-bold theme-text-main border-b pb-2 border-slate-200">
            <History size={18} className="theme-text-faint" />
            <h3>My Recent Task Activities</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex items-center gap-1.5"><Cpu size={14} /> Scheduled Automations ({scheduledActivities.length})</h4>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {scheduledActivities.length > 0 ? (
                  scheduledActivities.map((log) => (
                    <div key={log.id} onClick={() => setSelectedLog(log)} className="theme-card p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-blue-400 transition-all cursor-pointer">
                      <div>
                        <p className="text-sm font-bold theme-text-main">{log.playbook}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${log.status === "Success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{log.status}</span>
                        <p className="text-[9px] theme-text-faint font-bold mt-2 uppercase">{log.date} • {log.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="theme-text-faint text-xs italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">No automation engine dispatches logged.</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-wider flex items-center gap-1.5"><UserCheck size={14} /> Manual Dispatches ({manualActivities.length})</h4>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {manualActivities.length > 0 ? (
                  manualActivities.map((log) => (
                    <div key={log.id} onClick={() => setSelectedLog(log)} className="theme-card p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-purple-400 transition-all cursor-pointer">
                      <div>
                        <p className="text-sm font-bold theme-text-main">{log.playbook}</p>
                        <p className="text-[10px] theme-text-faint font-bold uppercase tracking-widest mt-1">Manual Run Override</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${log.status === "Success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{log.status}</span>
                        <p className="text-[9px] theme-text-faint font-bold mt-2 uppercase">{log.date} • {log.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="theme-text-faint text-xs italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">No manual operational tasks executed.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderView = () => {
    const viewProps = { searchQuery };

    if (role === "admin") {
      switch (activeView) {
        case "controllers": return <Controllers {...viewProps} />;
        case "playbooks": return <Playbooks {...viewProps} />;
        case "users": return <UserManagement {...viewProps} />;
        case "groups": return <GroupManagement {...viewProps} />;
        default: return renderOverview();
      }
    } else {
      switch (activeView) {
        case "user-overview": return renderUserOverview();
        case "my-work": return <UserTasks {...viewProps} />;
        case "calendar": return <UserCalendar {...viewProps} />;
        default: return renderUserOverview();
      }
    }
  };

  return (
    <div className="flex h-screen theme-workspace p-2 md:p-4 lg:p-6 font-sans overflow-hidden gap-0 md:gap-6 relative">

      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* RESPONSIVE SIDEBAR DRAWER */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 theme-sidebar md:rounded-[2rem] shadow-2xl md:shadow-sm flex flex-col shrink-0 overflow-hidden transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 md:p-8 flex items-center justify-between gap-3 border-b border-slate-100 md:border-none">
          <div className="flex items-center gap-3">
            <img src="/paregrinLogo.png" alt="Paregrin Logo" className="h-7 w-auto object-contain select-none" />
            <span className="font-black text-xl tracking-[0.05em] theme-text-main font-sans select-none">PAREGRINE</span>
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden theme-text-muted p-2 rounded-xl hover:bg-slate-50">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 md:py-2 space-y-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {role === "admin" ? (
            <>
              <SidebarItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeView === "overview"} onClick={() => { setActiveView("overview"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<Server size={20} />} label="Automation Domains" active={activeView === "controllers"} onClick={() => { setActiveView("controllers"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<FileCode size={20} />} label="Automation Functions" active={activeView === "playbooks"} onClick={() => { setActiveView("playbooks"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<Users size={20} />} label="User Management" active={activeView === "users"} onClick={() => { setActiveView("users"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<Users size={20} />} label="User Groups" active={activeView === "groups"} onClick={() => { setActiveView("groups"); setIsSidebarOpen(false); }} />
            </>
          ) : (
            <>
              <SidebarItem icon={<LayoutDashboard size={20} />} label="Workspace Overview" active={activeView === "user-overview"} onClick={() => { setActiveView("user-overview"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<ClipboardList size={20} />} label="My Work List" active={activeView === "my-work"} onClick={() => { setActiveView("my-work"); setIsSidebarOpen(false); }} />
              <SidebarItem icon={<CalIcon size={20} />} label="Schedule Task" active={activeView === "calendar"} onClick={() => { setActiveView("calendar"); setIsSidebarOpen(false); }} />
            </>
          )}
        </nav>

        <div className="p-6 mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full theme-text-muted hover:text-red-500 rounded-2xl font-bold transition-all"><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full relative">

        {/* RESPONSIVE HEADER W/ SEARCH & DATE/TIME */}
        <header className="flex items-center justify-between theme-card border border-slate-200/60 shadow-sm px-4 md:px-6 py-3 md:rounded-[2rem] rounded-2xl mb-4 md:mb-6 shrink-0 transition-all hover:shadow-md">

          {/* Mobile Hamburger Menu */}
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-brand-primary transition-colors">
            <Menu size={24} />
          </button>

          {/* Left Side: Search Bar */}
          <div className="relative w-full max-w-md hidden sm:block ml-4 md:ml-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all text-slate-700 font-medium"
            />
          </div>

          {/* Right Side: Live Date/Time & Profile */}
          <div className="flex items-center gap-4 md:gap-6 ml-auto">

            {/* Live Ticking Clock */}
            <div className="text-right hidden lg:block">
              <p className="text-sm font-black theme-text-main leading-none">{formattedTime}</p>
              <p className="text-[10px] font-bold theme-text-muted uppercase tracking-tight mt-1">{formattedDate}</p>
            </div>

            {/* Vertical Divider */}
            <div className="w-px h-8 bg-slate-200 hidden lg:block"></div>

            {/* Profile Info */}
            <div onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block transition-all group-hover:opacity-80">
                <p className="text-xs font-black theme-text-main leading-none">{userFullName}</p>
                <p className="text-[9px] font-bold theme-text-faint uppercase tracking-tight mt-1">{profileData.designation || (role === "admin" ? "ADMINISTRATOR" : "TEAM MEMBER")}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-cyan-50 text-brand-primary flex items-center justify-center overflow-hidden border border-slate-200/50 shadow-sm group-hover:shadow-md transition-all shrink-0">
                {profileData.preview_url ? <img src={profileData.preview_url} alt="Profile" className="w-full h-full object-cover" /> : <User size={18} />}
              </div>
            </div>

          </div>
        </header>

        {/* INVISIBLE SCROLLBAR APPLIED TO MAIN VIEWPORT */}
        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {telemetryLoading ? (
            <div className="min-h-[60vh] flex items-center justify-center theme-text-faint gap-2 font-medium">
              <Activity className="animate-spin text-brand-primary" size={20} />
              <span>Syncing workspace logs...</span>
            </div>
          ) : (
            renderView()
          )}
        </div>
      </main>

      {/* RAW LOG VIEWER MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-white font-bold text-sm">Execution Terminal Logs</h3>
                <p className="text-slate-400 text-xs">{selectedLog.playbook} • {selectedLog.date} at {selectedLog.time}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white p-2"><X size={20}/></button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <pre className={`text-[10px] md:text-[11px] font-mono whitespace-pre-wrap break-words ${selectedLog.status === 'Success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {selectedLog.full_logs}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className="theme-card rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform animate-in zoom-in-95 duration-200 mx-auto">
            <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-base font-bold theme-text-main">My System Profile</h2>
              <button onClick={() => setIsProfileModalOpen(false)} className="theme-text-faint hover:text-slate-600 p-2 -mr-2"><X size={18} /></button>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-5 md:p-6 space-y-4">
              <div className="flex flex-col items-center gap-1.5 mb-2">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group shadow-inner">
                  {profileData.preview_url ? <img src={profileData.preview_url} alt="Avatar" className="w-full h-full object-cover" /> : <User size={30} className="text-slate-300" />}
                  <label className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) setProfileData({ ...profileData, file_obj: file, preview_url: URL.createObjectURL(file) }); }} />
                  </label>
                </div>
                <span className="text-[9px] font-black theme-text-faint uppercase tracking-widest">Change Photo</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required placeholder="First Name" value={profileData.first_name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary text-xs font-bold theme-text-main" onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })} />
                <input type="text" required placeholder="Last Name" value={profileData.last_name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary text-xs font-bold theme-text-main" onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })} />
              </div>
              <input type="text" required placeholder="Designation Title" value={profileData.designation} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary text-xs font-bold theme-text-main" onChange={(e) => setProfileData({ ...profileData, designation: e.target.value })} />
              <input type="email" required placeholder="Enterprise Email" value={profileData.email} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary text-xs font-semibold theme-text-main" onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} />
              <input type="text" required placeholder="Mobile" value={profileData.mobile} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary text-xs font-mono font-bold theme-text-main" onChange={(e) => setProfileData({ ...profileData, mobile: e.target.value })} />
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="w-full sm:flex-1 py-3 border border-slate-200 rounded-xl font-bold text-xs theme-text-faint hover:bg-slate-50">Cancel</button>
                <button type="submit" className="w-full sm:flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-xs hover:opacity-90 shadow-lg shadow-slate-300">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, color, sub, pulse }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-50 text-slate-600",
  };
  return (
    <div className="theme-card p-6 rounded-[2.5rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className={`p-3 w-fit rounded-2xl ${colors[color] || colors.slate}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase theme-text-faint tracking-widest">{label}</p>
        <div className="text-3xl font-black theme-text-main mt-1">{value}</div>
      </div>
      <div className="flex items-center gap-1.5 theme-text-faint text-[11px] font-bold">
        {pulse && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
        {sub}
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick }) => (
  <div onClick={onClick} className={`sidebar-link ${active ? "sidebar-link-active" : "sidebar-link-inactive"}`}>
    {icon} <span>{label}</span>
  </div>
);

export default Dashboard;
