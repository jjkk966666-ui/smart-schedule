import { useState, useEffect } from 'react';
import { authService } from './services/authService';
import { scheduleService } from './services/scheduleService';
import { aiService } from './services/aiService';
import type { Schedule, CreateScheduleData, User, ScheduleStats, TimeRecommendation, AIPlanningResult, AISuggestion, GeneratePlanResult, PlanningHistoryItem, AIUsageInfo, WeeklyReportData } from './types';
import './App.css';
// Recharts 图表组件
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 主题类型
type ThemeMode = 'light' | 'dark';

// 图表颜色配置
const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showLogin, setShowLogin] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  
  // 主题模式状态
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // 从 localStorage 读取保存的主题，默认为 light
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    return savedTheme || 'light';
  });

  // 日程筛选状态
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [recommendations, setRecommendations] = useState<TimeRecommendation | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAIPlanning, setShowAIPlanning] = useState(false);
  const [planningResult, setPlanningResult] = useState<AIPlanningResult | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  
  // AI建议历史查看
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [scheduleSuggestions, setScheduleSuggestions] = useState<AISuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // 编辑日程
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState<CreateScheduleData>({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    priority: 'medium',
    isAllDay: false,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editConflicts, setEditConflicts] = useState<Schedule[]>([]);

  // 智能科学规划
  const [showSmartPlanning, setShowSmartPlanning] = useState(false);
  const [smartPlanDescription, setSmartPlanDescription] = useState('');
  const [smartPlanLoading, setSmartPlanLoading] = useState(false);
  const [smartPlanResult, setSmartPlanResult] = useState<GeneratePlanResult | null>(null);
  const [selectedPlanItems, setSelectedPlanItems] = useState<Set<number>>(new Set());
  const [savingPlan, setSavingPlan] = useState(false);

  // AI规划历史记录侧边栏
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [planningHistory, setPlanningHistory] = useState<PlanningHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  // VIP兑换相关
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipCode, setVipCode] = useState('');
  const [vipLoading, setVipLoading] = useState(false);
  const [vipError, setVipError] = useState('');
  const [vipSuccess, setVipSuccess] = useState('');

  // AI使用情况
  const [aiUsage, setAiUsage] = useState<AIUsageInfo | null>(null);

  // VIP周报分析
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [weeklyReportData, setWeeklyReportData] = useState<WeeklyReportData | null>(null);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [weeklyReportError, setWeeklyReportError] = useState('');

  // 登录/注册表单
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  // 将 Date 对象转换为 datetime-local 格式的本地时间字符串
  const toLocalDateTimeString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // 获取当前时间和1小时后的时间(datetime-local格式)
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30); // 向上取整到最近的30分钟
    return toLocalDateTimeString(now);
  };

  const getDefaultEndTime = () => {
    const later = new Date();
    later.setMinutes(Math.ceil(later.getMinutes() / 30) * 30);
    later.setHours(later.getHours() + 1); // 默认1小时后
    return toLocalDateTimeString(later);
  };

  // 日程表单
  const [scheduleForm, setScheduleForm] = useState<CreateScheduleData>({
    title: '',
    description: '',
    startTime: getDefaultStartTime(),
    endTime: getDefaultEndTime(),
    location: '',
    priority: 'medium',
    isAllDay: false,
  });

  // 主题切换效果
  useEffect(() => {
    // 应用主题到 document.body
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 切换主题
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (authService.isAuthenticated()) {
      loadUser();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadSchedules();
      loadStats();
      loadPlanningHistory();
    }
  }, [isAuthenticated]);

  // 当时间变化时检查冲突
  useEffect(() => {
    if (scheduleForm.startTime && scheduleForm.endTime && isAuthenticated) {
      checkTimeConflicts();
    }
  }, [scheduleForm.startTime, scheduleForm.endTime]);

  const loadUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('加载用户失败:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const data = await scheduleService.getSchedules();
      setSchedules(data.items);
    } catch (error) {
      console.error('加载日程失败:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await scheduleService.getStats();
      setStats(data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  // 加载AI规划历史
  const loadPlanningHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await scheduleService.getPlanningHistory();
      setPlanningHistory(data.items);
      setHistoryTotal(data.total);
    } catch (error) {
      console.error('加载规划历史失败:', error);
      setPlanningHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 删除规划历史
  const handleDeleteHistory = async (id: string) => {
    if (!confirm('确定要删除这条规划历史吗？')) return;
    try {
      await scheduleService.deletePlanningHistory(id);
      await loadPlanningHistory();
    } catch (error) {
      console.error('删除规划历史失败:', error);
      alert('删除失败');
    }
  };

  const checkTimeConflicts = async () => {
    try {
      const startTime = new Date(scheduleForm.startTime).toISOString();
      const endTime = new Date(scheduleForm.endTime).toISOString();
      const result = await scheduleService.checkConflicts(startTime, endTime);
      setConflicts(result.conflicts);
    } catch (error) {
      console.error('检查冲突失败:', error);
      setConflicts([]);
    }
  };

  const loadRecommendations = async () => {
    try {
      setShowRecommendations(true);
      setLoadingAI(true);
      const duration = 60; // 默认推荐1小时的时间段
      const data = await aiService.suggestTime(duration);
      setRecommendations(data);
    } catch (error) {
      console.error('获取推荐失败:', error);
      setRecommendations(null);
    } finally {
      setLoadingAI(false);
    }
  };

  // AI智能规划分析
  const handleAIPlanning = async () => {
    if (!scheduleForm.title) {
      alert('请先输入任务标题');
      return;
    }

    try {
      setPlanningLoading(true);
      setShowAIPlanning(true);
      
      const taskDescription = `${scheduleForm.title}${scheduleForm.description ? ': ' + scheduleForm.description : ''}`;
      const result = await aiService.analyzePlanning(taskDescription, 60);
      setPlanningResult(result);
    } catch (error: any) {
      console.error('AI规划分析失败:', error);
      setPlanningResult({
        success: false,
        error: error.response?.data?.error?.message || 'AI分析失败，请检查API配置',
      });
    } finally {
      setPlanningLoading(false);
    }
  };

  const applyPlanningTime = (startTime: string, endTime: string) => {
    const start = toLocalDateTimeString(new Date(startTime));
    const end = toLocalDateTimeString(new Date(endTime));
    setScheduleForm({
      ...scheduleForm,
      startTime: start,
      endTime: end,
    });
    setShowAIPlanning(false);
  };

  const applyRecommendation = (startTime: string, endTime: string) => {
    const start = toLocalDateTimeString(new Date(startTime));
    const end = toLocalDateTimeString(new Date(endTime));
    setScheduleForm({
      ...scheduleForm,
      startTime: start,
      endTime: end,
    });
    setShowRecommendations(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (showLogin) {
        await authService.login({
          email: formData.email,
          password: formData.password,
        });
      } else {
        await authService.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });
      }
      await loadUser();
      setFormData({ email: '', password: '', name: '' });
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setSchedules([]);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 如果有冲突，确认是否继续
    if (conflicts.length > 0) {
      const confirmed = confirm(
        `检测到 ${conflicts.length} 个时间冲突。是否仍要添加此日程？`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      // 将 datetime-local 格式转换为完整的 ISO-8601 格式
      const scheduleData = {
        ...scheduleForm,
        startTime: new Date(scheduleForm.startTime).toISOString(),
        endTime: new Date(scheduleForm.endTime).toISOString(),
      };
      const newSchedule = await scheduleService.createSchedule(scheduleData);
      
      // 如果有AI规划建议，保存到数据库
      if (planningResult && planningResult.success && newSchedule.id) {
        try {
          await scheduleService.saveAISuggestion(newSchedule.id, {
            suggestionType: 'planning',
            content: JSON.stringify(planningResult),
            metadata: {
              taskTitle: scheduleForm.title,
              taskDescription: scheduleForm.description || '',
              generatedAt: new Date().toISOString(),
            },
          });
        } catch (saveError) {
          console.error('保存AI建议失败:', saveError);
          // 不阻断流程，继续执行
        }
      }
      
      setShowAddForm(false);
      setShowAIPlanning(false);
      setPlanningResult(null);
      // 重置表单并设置新的默认时间
      setScheduleForm({
        title: '',
        description: '',
        startTime: getDefaultStartTime(),
        endTime: getDefaultEndTime(),
        location: '',
        priority: 'medium',
        isAllDay: false,
      });
      setConflicts([]);
      await loadSchedules();
      await loadStats();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看日程的AI建议历史
  const handleViewAISuggestions = async (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowAISuggestions(true);
    setLoadingSuggestions(true);
    
    try {
      const suggestions = await scheduleService.getAISuggestions(schedule.id);
      setScheduleSuggestions(suggestions);
    } catch (error) {
      console.error('加载AI建议失败:', error);
      setScheduleSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 打开编辑模态框
  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setEditForm({
      title: schedule.title,
      description: schedule.description || '',
      startTime: toLocalDateTimeString(new Date(schedule.startTime)),
      endTime: toLocalDateTimeString(new Date(schedule.endTime)),
      location: schedule.location || '',
      priority: schedule.priority,
      isAllDay: schedule.isAllDay,
    });
    setEditConflicts([]);
    setShowEditForm(true);
  };

  // 检查编辑时的冲突
  const checkEditConflicts = async () => {
    if (!editingSchedule || !editForm.startTime || !editForm.endTime) return;
    
    try {
      const startTime = new Date(editForm.startTime).toISOString();
      const endTime = new Date(editForm.endTime).toISOString();
      const result = await scheduleService.checkConflicts(startTime, endTime, editingSchedule.id);
      setEditConflicts(result.conflicts);
    } catch (error) {
      console.error('检查冲突失败:', error);
      setEditConflicts([]);
    }
  };

  // 编辑时间变化时检查冲突
  useEffect(() => {
    if (showEditForm && editForm.startTime && editForm.endTime) {
      checkEditConflicts();
    }
  }, [editForm.startTime, editForm.endTime, showEditForm]);

  // 保存编辑
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    // 如果有冲突，确认是否继续
    if (editConflicts.length > 0) {
      const confirmed = confirm(
        `检测到 ${editConflicts.length} 个时间冲突。是否仍要保存？`
      );
      if (!confirmed) return;
    }

    setEditLoading(true);
    try {
      const updateData = {
        id: editingSchedule.id,
        title: editForm.title,
        description: editForm.description,
        startTime: new Date(editForm.startTime).toISOString(),
        endTime: new Date(editForm.endTime).toISOString(),
        location: editForm.location,
        priority: editForm.priority,
        isAllDay: editForm.isAllDay,
      };
      
      await scheduleService.updateSchedule(editingSchedule.id, updateData);
      setShowEditForm(false);
      setEditingSchedule(null);
      setEditConflicts([]);
      await loadSchedules();
      await loadStats();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '保存失败');
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setEditingSchedule(null);
    setEditConflicts([]);
  };

  const closeAISuggestionsModal = () => {
    setShowAISuggestions(false);
    setSelectedSchedule(null);
    setScheduleSuggestions([]);
  };

  // 解析AI建议内容
  const parseAISuggestionContent = (content: string): AIPlanningResult | null => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  // 智能科学规划功能
  const handleSmartPlanGenerate = async () => {
    if (!smartPlanDescription.trim()) {
      alert('请输入日程描述');
      return;
    }

    setSmartPlanLoading(true);
    setSmartPlanResult(null);
    setSelectedPlanItems(new Set());

    try {
      const result = await scheduleService.generatePlan(smartPlanDescription);
      setSmartPlanResult(result);
      
      // 更新使用情况
      if (result.usage) {
        setAiUsage(result.usage);
      }
      
      // 默认选中所有生成的日程
      if (result.success && result.schedules) {
        setSelectedPlanItems(new Set(result.schedules.map((_, i) => i)));
      }
    } catch (error: any) {
      setSmartPlanResult({
        success: false,
        error: error.response?.data?.error?.message || '生成失败，请检查AI配置',
      });
    } finally {
      setSmartPlanLoading(false);
    }
  };

  const togglePlanItemSelection = (index: number) => {
    const newSelected = new Set(selectedPlanItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPlanItems(newSelected);
  };

  const handleSaveSelectedPlan = async () => {
    if (!smartPlanResult?.schedules || selectedPlanItems.size === 0) {
      alert('请至少选择一个日程');
      return;
    }

    setSavingPlan(true);
    try {
      const schedulesToSave = smartPlanResult.schedules.filter((_, i) => selectedPlanItems.has(i));
      const result = await scheduleService.savePlan(
        schedulesToSave,
        smartPlanDescription,
        smartPlanResult.summary
      );
      
      if (result.created > 0) {
        alert(`成功保存 ${result.created} 个日程！${result.errors.length > 0 ? `\n${result.errors.length} 个失败` : ''}`);
        setShowSmartPlanning(false);
        setSmartPlanDescription('');
        setSmartPlanResult(null);
        setSelectedPlanItems(new Set());
        await loadSchedules();
        await loadStats();
        await loadPlanningHistory(); // 刷新规划历史
      } else {
        alert('保存失败: ' + (result.errors.join(', ') || '未知错误'));
      }
    } catch (error: any) {
      alert('保存失败: ' + (error.response?.data?.error?.message || '未知错误'));
    } finally {
      setSavingPlan(false);
    }
  };

  const closeSmartPlanning = () => {
    setShowSmartPlanning(false);
    setSmartPlanDescription('');
    setSmartPlanResult(null);
    setSelectedPlanItems(new Set());
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('确定要删除这个日程吗?')) return;
    try {
      await scheduleService.deleteSchedule(id);
      await loadSchedules();
      await loadStats();
    } catch (error) {
      alert('删除失败');
    }
  };

  // 切换日程完成状态
  const handleToggleComplete = async (schedule: Schedule, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发编辑
    try {
      const newStatus = schedule.status === 'completed' ? 'pending' : 'completed';
      await scheduleService.updateSchedule(schedule.id, {
        id: schedule.id,
        status: newStatus,
      });
      await loadSchedules();
      await loadStats();
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新状态失败');
    }
  };

  // 根据筛选条件过滤日程
  const getFilteredSchedules = () => {
    if (activeFilter === 'all') {
      return schedules;
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    switch (activeFilter) {
      case 'today':
        return schedules.filter(s => {
          const startTime = new Date(s.startTime);
          return startTime >= todayStart && startTime < todayEnd;
        });
      case 'thisWeek':
        return schedules.filter(s => {
          const startTime = new Date(s.startTime);
          return startTime >= weekStart && startTime < weekEnd;
        });
      case 'pending':
        return schedules.filter(s => s.status === 'pending' || s.status === 'in_progress');
      case 'completed':
        return schedules.filter(s => s.status === 'completed');
      case 'highPriority':
        return schedules.filter(s => s.priority === 'high' || s.priority === 'urgent');
      default:
        return schedules;
    }
  };

  // 获取筛选后的日程
  const filteredSchedules = getFilteredSchedules();
  
  // 将日程分为未完成和已完成两组（仅在"全部"视图时分组）
  const getGroupedSchedules = () => {
    if (activeFilter !== 'all') {
      return { incomplete: filteredSchedules, completed: [] };
    }
    const incomplete = filteredSchedules.filter(s => s.status !== 'completed');
    const completed = filteredSchedules.filter(s => s.status === 'completed');
    return { incomplete, completed };
  };

  const { incomplete: incompleteSchedules, completed: completedSchedules } = getGroupedSchedules();

  // 获取筛选器标签
  const getFilterLabel = (filter: string) => {
    const labels: Record<string, string> = {
      all: '全部',
      today: '今日',
      thisWeek: '本周',
      pending: '待完成',
      completed: '已完成',
      highPriority: '高优先级',
    };
    return labels[filter] || filter;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: '#4caf50',
      medium: '#2196f3',
      high: '#ff9800',
      urgent: '#f44336',
    };
    return colors[priority as keyof typeof colors] || '#2196f3';
  };

  // VIP通行证兑换
  const handleVipRedeem = async () => {
    if (!vipCode.trim()) {
      setVipError('请输入通行证码');
      return;
    }

    setVipLoading(true);
    setVipError('');
    setVipSuccess('');

    try {
      const result = await authService.redeemVipPassport(vipCode.trim());
      setVipSuccess(result.message);
      setVipCode('');
      // 刷新用户信息
      await loadUser();
      // 3秒后关闭弹窗
      setTimeout(() => {
        setShowVipModal(false);
        setVipSuccess('');
      }, 3000);
    } catch (error: any) {
      setVipError(error.response?.data?.error?.message || '兑换失败，请检查通行证码');
    } finally {
      setVipLoading(false);
    }
  };

  const closeVipModal = () => {
    setShowVipModal(false);
    setVipCode('');
    setVipError('');
    setVipSuccess('');
  };

  // VIP周报分析
  const handleLoadWeeklyReport = async () => {
    if (!user?.isVip) {
      setWeeklyReportError('周报分析是VIP专属功能，请先升级VIP');
      setShowWeeklyReport(true);
      return;
    }

    setShowWeeklyReport(true);
    setWeeklyReportLoading(true);
    setWeeklyReportError('');
    setWeeklyReportData(null);

    try {
      const data = await aiService.getWeeklyReport();
      setWeeklyReportData(data);
    } catch (error: any) {
      setWeeklyReportError(error.response?.data?.error?.message || '获取周报失败');
    } finally {
      setWeeklyReportLoading(false);
    }
  };

  const closeWeeklyReport = () => {
    setShowWeeklyReport(false);
    setWeeklyReportData(null);
    setWeeklyReportError('');
  };

  // 获取效率分数颜色
  const getEfficiencyScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  // 获取效率分数等级
  const getEfficiencyScoreLevel = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 60) return '一般';
    if (score >= 40) return '需改进';
    return '较差';
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>📅 智能日程表</h1>
          <div className="auth-tabs">
            <button
              className={showLogin ? 'active' : ''}
              onClick={() => setShowLogin(true)}
            >
              登录
            </button>
            <button
              className={!showLogin ? 'active' : ''}
              onClick={() => setShowLogin(false)}
            >
              注册
            </button>
          </div>
          <form onSubmit={handleAuth} className="auth-form">
            {!showLogin && (
              <input
                type="text"
                placeholder="姓名"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            )}
            <input
              type="email"
              placeholder="邮箱"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="密码 (至少6位)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
            <button type="submit" disabled={loading}>
              {loading ? '处理中...' : showLogin ? '登录' : '注册'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${showHistorySidebar ? 'sidebar-open' : ''}`}>
      {/* AI规划历史记录侧边栏 */}
      <aside className={`history-sidebar ${showHistorySidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>📜 规划历史</h3>
          <button className="sidebar-close" onClick={() => setShowHistorySidebar(false)}>×</button>
        </div>
        <div className="sidebar-content">
          {loadingHistory ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>加载中...</p>
            </div>
          ) : planningHistory.length === 0 ? (
            <div className="empty-history">
              <p>📭 暂无规划历史</p>
              <p className="hint">使用智能科学规划功能后，历史记录会显示在这里</p>
            </div>
          ) : (
            <div className="history-list">
              <div className="history-count">共 {historyTotal} 条记录</div>
              {planningHistory.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <span className="history-time">{formatDate(item.createdAt)}</span>
                    <button
                      className="btn-delete-history"
                      onClick={() => handleDeleteHistory(item.id)}
                      title="删除记录"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="history-description">
                    <strong>描述：</strong>{item.description}
                  </div>
                  {item.summary && (
                    <div className="history-summary">
                      <strong>摘要：</strong>{item.summary}
                    </div>
                  )}
                  <div className="history-schedules">
                    <strong>生成的日程 ({item.generatedPlan.length})：</strong>
                    <div className="history-schedule-list">
                      {item.generatedPlan.map((schedule, index) => (
                        <div key={index} className="history-schedule-item">
                          <div className="history-schedule-title">
                            <span className={`priority-dot priority-${schedule.priority}`}></span>
                            {schedule.title}
                          </div>
                          <div className="history-schedule-time">
                            {formatDate(schedule.startTime)} - {formatDate(schedule.endTime)}
                          </div>
                          {schedule.reason && (
                            <div className="history-schedule-reason">
                              💡 {schedule.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="history-saved-count">
                    ✅ 已保存 {item.savedCount} 个日程
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <header className="app-header">
        <h1>📅 智能日程表</h1>
        <div className="header-actions">
          {/* 主题切换按钮 */}
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          
          <button
            className={`btn-history ${showHistorySidebar ? 'active' : ''}`}
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            title="规划历史"
          >
            📜 规划历史 {historyTotal > 0 && `(${historyTotal})`}
          </button>
          
          {/* VIP状态显示 */}
          <div className="vip-status-wrapper">
            {user?.isVip ? (
              <>
                <span className="vip-badge active" title={`VIP剩余 ${user.vipRemainingHours} 小时`}>
                  👑 VIP ({user.vipRemainingHours}h)
                </span>
                <button
                  className="btn-weekly-report"
                  onClick={handleLoadWeeklyReport}
                  title="查看本周AI分析报告"
                >
                  📊 周报
                </button>
              </>
            ) : (
              <button className="btn-vip" onClick={() => setShowVipModal(true)}>
                👑 兑换VIP
              </button>
            )}
          </div>
          
          <span>欢迎, {user?.name}</span>
          <button onClick={handleLogout}>退出</button>
        </div>
      </header>

      {/* VIP兑换弹窗 */}
      {showVipModal && (
        <div className="modal-overlay" onClick={closeVipModal}>
          <div className="modal-content vip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👑 VIP通行证兑换</h2>
              <button className="modal-close" onClick={closeVipModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="vip-info">
                <p>🎯 VIP特权：</p>
                <ul>
                  <li>✨ 使用更强大的AI模型进行规划</li>
                  <li>📈 每日智能规划次数提升至 <strong>10次</strong>（普通用户5次）</li>
                  <li>⏰ 有效期：24小时</li>
                </ul>
              </div>
              
              <div className="vip-form">
                <input
                  type="text"
                  placeholder="请输入12位通行证码"
                  value={vipCode}
                  onChange={(e) => setVipCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  disabled={vipLoading}
                />
                <button
                  className="btn-redeem"
                  onClick={handleVipRedeem}
                  disabled={vipLoading || !vipCode.trim()}
                >
                  {vipLoading ? '⏳ 兑换中...' : '🎁 兑换'}
                </button>
              </div>
              
              {vipError && (
                <div className="vip-error">❌ {vipError}</div>
              )}
              
              {vipSuccess && (
                <div className="vip-success">✅ {vipSuccess}</div>
              )}
              
              {user?.isVip && (
                <div className="vip-current-status">
                  <p>🎉 您当前已是VIP用户</p>
                  <p>⏰ 剩余时间：{user.vipRemainingHours} 小时</p>
                  <p className="hint">兑换新通行证将延长24小时有效期</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIP周报分析模态框 */}
      {showWeeklyReport && (
        <div className="modal-overlay" onClick={closeWeeklyReport}>
          <div className="modal-content weekly-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 本周AI分析报告</h2>
              <button className="modal-close" onClick={closeWeeklyReport}>×</button>
            </div>
            
            <div className="modal-body">
              {weeklyReportLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>AI正在分析您的一周日程数据...</p>
                </div>
              ) : weeklyReportError ? (
                <div className="error-state">
                  <p>❌ {weeklyReportError}</p>
                  {!user?.isVip && (
                    <button
                      className="btn-upgrade-vip"
                      onClick={() => { closeWeeklyReport(); setShowVipModal(true); }}
                    >
                      👑 升级VIP解锁周报
                    </button>
                  )}
                </div>
              ) : weeklyReportData ? (
                <div className="weekly-report-content">
                  {/* 概览统计 */}
                  <div className="report-overview">
                    <div className="overview-card">
                      <div className="overview-value">{weeklyReportData.totalSchedules}</div>
                      <div className="overview-label">总日程数</div>
                    </div>
                    <div className="overview-card completed">
                      <div className="overview-value">{weeklyReportData.completedSchedules}</div>
                      <div className="overview-label">已完成</div>
                    </div>
                    <div className="overview-card incomplete">
                      <div className="overview-value">{weeklyReportData.incompleteSchedules}</div>
                      <div className="overview-label">未完成</div>
                    </div>
                    <div className="overview-card rate">
                      <div className="overview-value">{weeklyReportData.completionRate.toFixed(1)}%</div>
                      <div className="overview-label">完成率</div>
                    </div>
                  </div>

                  {/* 效率评分 */}
                  <div className="efficiency-score-section">
                    <h3>🎯 效率评分</h3>
                    <div className="score-display">
                      <div
                        className="score-circle"
                        style={{ borderColor: getEfficiencyScoreColor(weeklyReportData.efficiencyScore) }}
                      >
                        <span
                          className="score-number"
                          style={{ color: getEfficiencyScoreColor(weeklyReportData.efficiencyScore) }}
                        >
                          {weeklyReportData.efficiencyScore}
                        </span>
                        <span className="score-label">分</span>
                      </div>
                      <div className="score-level">
                        等级：<strong style={{ color: getEfficiencyScoreColor(weeklyReportData.efficiencyScore) }}>
                          {getEfficiencyScoreLevel(weeklyReportData.efficiencyScore)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 分类占比饼图 */}
                  {weeklyReportData.categoryBreakdown && weeklyReportData.categoryBreakdown.length > 0 && (
                    <div className="category-chart-section">
                      <h3>📈 时间分配分析</h3>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={weeklyReportData.categoryBreakdown}
                              dataKey="percentage"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                            >
                              {weeklyReportData.categoryBreakdown.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value, name) => [`${(typeof value === 'number' ? value : 0).toFixed(1)}%`, name as string]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="category-details">
                        {weeklyReportData.categoryBreakdown.map((cat, index) => (
                          <div key={cat.category} className="category-item">
                            <span
                              className="category-color"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="category-name">{cat.category}</span>
                            <span className="category-stats">
                              {cat.hours.toFixed(1)}h · {cat.completedCount}/{cat.totalCount}完成
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 每日完成情况柱状图 */}
                  {weeklyReportData.dailyStats && weeklyReportData.dailyStats.length > 0 && (
                    <div className="daily-chart-section">
                      <h3>📅 每日完成情况</h3>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={weeklyReportData.dailyStats}>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="completed" name="已完成" fill="#4caf50" />
                            <Bar dataKey="total" name="总数" fill="#2196f3" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* AI评语 */}
                  <div className="ai-commentary-section">
                    <h3>🤖 AI点评</h3>
                    <div className="ai-commentary">
                      {weeklyReportData.aiCommentary}
                    </div>
                  </div>

                  {/* 警告提示 */}
                  {weeklyReportData.warnings && weeklyReportData.warnings.length > 0 && (
                    <div className="warnings-section">
                      <h3>⚠️ 需要注意</h3>
                      <ul className="warnings-list">
                        {weeklyReportData.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 改进建议 */}
                  {weeklyReportData.recommendations && weeklyReportData.recommendations.length > 0 && (
                    <div className="recommendations-section">
                      <h3>💡 改进建议</h3>
                      <ul className="recommendations-list">
                        {weeklyReportData.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        {stats && (
          <div className="stats-panel">
            <div
              className={`stat-card clickable ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
              title="点击查看全部日程"
            >
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">总日程</div>
            </div>
            <div
              className={`stat-card clickable ${activeFilter === 'today' ? 'active' : ''}`}
              onClick={() => setActiveFilter('today')}
              title="点击查看今日日程"
            >
              <div className="stat-value">{stats.today}</div>
              <div className="stat-label">今日</div>
            </div>
            <div
              className={`stat-card clickable ${activeFilter === 'thisWeek' ? 'active' : ''}`}
              onClick={() => setActiveFilter('thisWeek')}
              title="点击查看本周日程"
            >
              <div className="stat-value">{stats.thisWeek}</div>
              <div className="stat-label">本周</div>
            </div>
            <div
              className={`stat-card clickable ${activeFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveFilter('pending')}
              title="点击查看待完成日程"
            >
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">待完成</div>
            </div>
            <div
              className={`stat-card clickable ${activeFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveFilter('completed')}
              title="点击查看已完成日程"
            >
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">已完成</div>
            </div>
            <div
              className={`stat-card clickable ${activeFilter === 'highPriority' ? 'active' : ''}`}
              onClick={() => setActiveFilter('highPriority')}
              title="点击查看高优先级日程"
            >
              <div className="stat-value">{stats.highPriority}</div>
              <div className="stat-label">高优先级</div>
            </div>
          </div>
        )}

        {/* 当前筛选提示 */}
        {activeFilter !== 'all' && (
          <div className="filter-indicator">
            <span>当前筛选：{getFilterLabel(activeFilter)}</span>
            <button className="btn-clear-filter" onClick={() => setActiveFilter('all')}>
              ✕ 清除筛选
            </button>
          </div>
        )}

        <div className="schedule-header">
          <h2>我的日程 ({filteredSchedules.length}{activeFilter !== 'all' ? ` / ${schedules.length}` : ''})</h2>
          <div className="header-buttons">
            <button
              className="btn-smart-plan"
              onClick={() => setShowSmartPlanning(true)}
            >
              🧪 智能科学规划
            </button>
            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? '取消' : '+ 添加日程'}
            </button>
          </div>
        </div>

        {/* 智能科学规划对话框 */}
        {showSmartPlanning && (
          <div className="modal-overlay" onClick={closeSmartPlanning}>
            <div className="modal-content smart-planning-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🧪 智能科学规划</h2>
                <button className="modal-close" onClick={closeSmartPlanning}>×</button>
              </div>
              
              <div className="modal-body">
                <div className="smart-plan-input-section">
                  <label htmlFor="planDescription">描述你的日程安排需求：</label>
                  <textarea
                    id="planDescription"
                    placeholder="例如：我这周一到周三要准备考试，每天下午复习数学，晚上复习英语"
                    value={smartPlanDescription}
                    onChange={(e) => setSmartPlanDescription(e.target.value)}
                    rows={4}
                    disabled={smartPlanLoading}
                  />
                  <button
                    className="btn-generate"
                    onClick={handleSmartPlanGenerate}
                    disabled={smartPlanLoading || !smartPlanDescription.trim()}
                  >
                    {smartPlanLoading ? '⏳ AI正在规划...' : '🚀 生成日程计划'}
                  </button>
                  
                  {/* 使用情况显示 */}
                  {aiUsage && (
                    <div className={`usage-info ${aiUsage.isLimitReached ? 'limit-reached' : ''}`}>
                      <span>今日使用: {aiUsage.usageCount}/{aiUsage.limit}</span>
                      {aiUsage.isLimitReached ? (
                        <span className="limit-warning">已达上限 {!user?.isVip && <button className="btn-upgrade-vip" onClick={() => { closeSmartPlanning(); setShowVipModal(true); }}>升级VIP</button>}</span>
                      ) : (
                        <span>剩余: {aiUsage.remaining}次</span>
                      )}
                    </div>
                  )}
                </div>

                {smartPlanLoading && (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>AI正在分析您的需求并生成科学的日程安排...</p>
                  </div>
                )}

                {smartPlanResult && !smartPlanLoading && (
                  <div className="smart-plan-result">
                    {smartPlanResult.success ? (
                      <>
                        {smartPlanResult.summary && (
                          <div className="plan-summary">
                            <h4>📋 规划摘要</h4>
                            <p>{smartPlanResult.summary}</p>
                          </div>
                        )}
                        
                        <div className="plan-schedules">
                          <div className="plan-schedules-header">
                            <h4>📅 生成的日程 ({smartPlanResult.schedules?.length || 0})</h4>
                            <span className="select-hint">点击日程可取消选择</span>
                          </div>
                          
                          <div className="plan-schedule-list">
                            {smartPlanResult.schedules?.map((schedule, index) => (
                              <div
                                key={index}
                                className={`plan-schedule-item ${selectedPlanItems.has(index) ? 'selected' : 'unselected'}`}
                                onClick={() => togglePlanItemSelection(index)}
                              >
                                <div className="plan-item-checkbox">
                                  {selectedPlanItems.has(index) ? '✅' : '⬜'}
                                </div>
                                <div className="plan-item-content">
                                  <div className="plan-item-title">
                                    <span className={`priority-badge priority-${schedule.priority}`}>
                                      {schedule.priority === 'urgent' ? '🔴' :
                                       schedule.priority === 'high' ? '🟠' :
                                       schedule.priority === 'medium' ? '🔵' : '🟢'}
                                    </span>
                                    {schedule.title}
                                  </div>
                                  <div className="plan-item-time">
                                    📅 {formatDate(schedule.startTime)} - {formatDate(schedule.endTime)}
                                  </div>
                                  {schedule.description && (
                                    <div className="plan-item-desc">{schedule.description}</div>
                                  )}
                                  {schedule.location && (
                                    <div className="plan-item-location">📍 {schedule.location}</div>
                                  )}
                                  {schedule.reason && (
                                    <div className="plan-item-reason">
                                      💡 <strong>安排理由：</strong>{schedule.reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="plan-actions">
                          <button
                            className="btn-save-plan"
                            onClick={handleSaveSelectedPlan}
                            disabled={savingPlan || selectedPlanItems.size === 0}
                          >
                            {savingPlan ? '⏳ 保存中...' : `💾 保存选中的 ${selectedPlanItems.size} 个日程`}
                          </button>
                          <button className="btn-cancel" onClick={closeSmartPlanning}>
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="error-state">
                        <p>❌ {smartPlanResult.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAddForm && (
          <div>
            <div className="ai-recommendations-section">
              <button
                type="button"
                className="btn-recommend"
                onClick={loadRecommendations}
                disabled={loadingAI}
              >
                {loadingAI ? '⏳ 分析中...' : '🤖 AI智能推荐时间'}
              </button>
              <button
                type="button"
                className="btn-ai-planning"
                onClick={handleAIPlanning}
                disabled={planningLoading || !scheduleForm.title}
              >
                {planningLoading ? '⏳ 分析中...' : '🧠 AI智能规划'}
              </button>
            </div>

            {showRecommendations && (
              <div className="recommendations-panel">
                <div className="panel-header">
                  <h3>
                    🤖 AI推荐的空闲时间段
                    {recommendations?.aiPowered && <span className="ai-badge">AI增强</span>}
                  </h3>
                  <button
                    type="button"
                    className="btn-close-panel"
                    onClick={() => setShowRecommendations(false)}
                  >
                    ×
                  </button>
                </div>
                
                {loadingAI ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>正在使用AI分析最佳时间...</p>
                  </div>
                ) : recommendations ? (
                  <>
                    <div className="recommendation-list">
                      {recommendations.recommendedSlots.map((slot, index) => (
                        <div
                          key={index}
                          className="recommendation-item"
                          onClick={() => applyRecommendation(slot.startTime, slot.endTime)}
                        >
                          <div className="recommendation-time">
                            📅 {formatDate(slot.startTime)} - {formatDate(slot.endTime)}
                          </div>
                          <div className="recommendation-reason">{slot.reason}</div>
                          <div className="recommendation-score">匹配度: {(slot.score * 100).toFixed(0)}%</div>
                        </div>
                      ))}
                    </div>
                    
                    {recommendations.generalAdvice && (
                      <div className="ai-advice">
                        <h4>💡 AI建议</h4>
                        <p>{recommendations.generalAdvice}</p>
                      </div>
                    )}
                    
                    {recommendations.productivityTips && recommendations.productivityTips.length > 0 && (
                      <div className="productivity-tips">
                        <h4>📈 效率提升建议</h4>
                        <ul>
                          {recommendations.productivityTips.map((tip, index) => (
                            <li key={index}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="no-recommendations">暂无推荐</p>
                )}
              </div>
            )}

            {showAIPlanning && (
              <div className="ai-planning-panel">
                <div className="panel-header">
                  <h3>🧠 AI智能规划分析</h3>
                  <button
                    type="button"
                    className="btn-close-panel"
                    onClick={() => setShowAIPlanning(false)}
                  >
                    ×
                  </button>
                </div>
                
                {planningLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>AI正在分析你的日程并生成最佳规划建议...</p>
                  </div>
                ) : planningResult ? (
                  planningResult.success ? (
                    <div className="planning-result">
                      {planningResult.overallAnalysis && (
                        <div className="analysis-section">
                          <h4>📊 整体分析</h4>
                          <p>{planningResult.overallAnalysis}</p>
                        </div>
                      )}
                      
                      {planningResult.prioritySuggestion && (
                        <div className="priority-section">
                          <h4>🎯 优先级建议: <span className={`priority-${planningResult.prioritySuggestion}`}>{planningResult.prioritySuggestion}</span></h4>
                          {planningResult.priorityReason && <p>{planningResult.priorityReason}</p>}
                        </div>
                      )}
                      
                      {planningResult.suggestedTimes && planningResult.suggestedTimes.length > 0 && (
                        <div className="suggested-times-section">
                          <h4>⏰ 建议时间</h4>
                          <div className="recommendation-list">
                            {planningResult.suggestedTimes.map((slot, index) => (
                              <div
                                key={index}
                                className="recommendation-item"
                                onClick={() => applyPlanningTime(slot.startTime, slot.endTime)}
                              >
                                <div className="recommendation-time">
                                  📅 {formatDate(slot.startTime)} - {formatDate(slot.endTime)}
                                </div>
                                <div className="recommendation-reason">{slot.reason}</div>
                                <div className="recommendation-score">推荐度: {(slot.score * 100).toFixed(0)}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {planningResult.coordination && (
                        <div className="coordination-section">
                          <h4>🔄 协调建议</h4>
                          <p>{planningResult.coordination}</p>
                        </div>
                      )}
                      
                      {planningResult.efficiencyTips && planningResult.efficiencyTips.length > 0 && (
                        <div className="tips-section">
                          <h4>💡 效率建议</h4>
                          <ul>
                            {planningResult.efficiencyTips.map((tip, index) => (
                              <li key={index}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="error-state">
                      <p>❌ {planningResult.error}</p>
                    </div>
                  )
                ) : null}
              </div>
            )}

            <form onSubmit={handleAddSchedule} className="schedule-form">
            <input
              type="text"
              placeholder="标题"
              value={scheduleForm.title}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, title: e.target.value })
              }
              required
            />
            <textarea
              placeholder="描述"
              value={scheduleForm.description}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, description: e.target.value })
              }
            />
            <div className="form-row">
              <input
                type="datetime-local"
                value={scheduleForm.startTime}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, startTime: e.target.value })
                }
                required
              />
              <input
                type="datetime-local"
                value={scheduleForm.endTime}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, endTime: e.target.value })
                }
                required
              />
            </div>
            <input
              type="text"
              placeholder="地点"
              value={scheduleForm.location}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, location: e.target.value })
              }
            />
            <select
              value={scheduleForm.priority}
              onChange={(e) =>
                setScheduleForm({
                  ...scheduleForm,
                  priority: e.target.value as any,
                })
              }
            >
              <option value="low">低优先级</option>
              <option value="medium">中优先级</option>
              <option value="high">高优先级</option>
              <option value="urgent">紧急</option>
            </select>

            {conflicts.length > 0 && (
              <div className="conflict-warning">
                ⚠️ 时间冲突警告：与 {conflicts.length} 个日程冲突
                <div className="conflict-list">
                  {conflicts.map((conflict) => (
                    <div key={conflict.id} className="conflict-item">
                      • {conflict.title} ({formatDate(conflict.startTime)} - {formatDate(conflict.endTime)})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" disabled={loading}>
              {loading ? '添加中...' : conflicts.length > 0 ? '⚠️ 仍要添加' : '添加日程'}
            </button>
            </form>
          </div>
        )}

        <div className="schedule-list">
          {filteredSchedules.length === 0 ? (
            <p className="empty-state">
              {activeFilter === 'all'
                ? '还没有日程,点击上方按钮添加吧!'
                : `没有${getFilterLabel(activeFilter)}的日程`}
            </p>
          ) : (
            <>
              {/* 未完成的日程 */}
              {incompleteSchedules.length > 0 && (
                <div className="schedule-section">
                  {activeFilter === 'all' && completedSchedules.length > 0 && (
                    <div className="section-header">
                      <h3>📋 进行中 ({incompleteSchedules.length})</h3>
                    </div>
                  )}
                  {incompleteSchedules.map((schedule) => (
                    <div key={schedule.id} className={`schedule-card ${schedule.status === 'completed' ? 'completed' : ''}`}>
                      {/* 完成勾选框 */}
                      <div
                        className="schedule-checkbox"
                        onClick={(e) => handleToggleComplete(schedule, e)}
                        title={schedule.status === 'completed' ? '标记为未完成' : '标记为已完成'}
                      >
                        <div className={`checkbox ${schedule.status === 'completed' ? 'checked' : ''}`}>
                          {schedule.status === 'completed' ? '✓' : ''}
                        </div>
                      </div>
                      <div
                        className="schedule-priority"
                        style={{ backgroundColor: getPriorityColor(schedule.priority) }}
                      />
                      <div
                        className="schedule-content"
                        onClick={() => handleEditSchedule(schedule)}
                        style={{ cursor: 'pointer' }}
                      >
                        <h3>{schedule.title}</h3>
                        {schedule.description && <p>{schedule.description}</p>}
                        <div className="schedule-meta">
                          <span>📅 {formatDate(schedule.startTime)} - {formatDate(schedule.endTime)}</span>
                          {schedule.location && <span>📍 {schedule.location}</span>}
                          <span className={`schedule-status status-${schedule.status}`}>
                            {schedule.status === 'pending' ? '待开始' :
                             schedule.status === 'in_progress' ? '进行中' :
                             schedule.status === 'completed' ? '已完成' : '已取消'}
                          </span>
                        </div>
                        <div className="schedule-edit-hint">
                          ✏️ 点击编辑日程
                        </div>
                      </div>
                      <div className="schedule-actions">
                        <button
                          className="btn-ai-view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewAISuggestions(schedule);
                          }}
                          title="查看AI建议"
                        >
                          🤖
                        </button>
                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchedule(schedule.id);
                          }}
                          title="删除日程"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 已完成的日程（仅在"全部"视图时显示分组） */}
              {activeFilter === 'all' && completedSchedules.length > 0 && (
                <div className="schedule-section completed-section">
                  <div className="section-header">
                    <h3>✅ 已完成 ({completedSchedules.length})</h3>
                  </div>
                  {completedSchedules.map((schedule) => (
                    <div key={schedule.id} className="schedule-card completed">
                      {/* 完成勾选框 */}
                      <div
                        className="schedule-checkbox"
                        onClick={(e) => handleToggleComplete(schedule, e)}
                        title="标记为未完成"
                      >
                        <div className="checkbox checked">✓</div>
                      </div>
                      <div
                        className="schedule-priority"
                        style={{ backgroundColor: getPriorityColor(schedule.priority) }}
                      />
                      <div
                        className="schedule-content"
                        onClick={() => handleEditSchedule(schedule)}
                        style={{ cursor: 'pointer' }}
                      >
                        <h3>{schedule.title}</h3>
                        {schedule.description && <p>{schedule.description}</p>}
                        <div className="schedule-meta">
                          <span>📅 {formatDate(schedule.startTime)} - {formatDate(schedule.endTime)}</span>
                          {schedule.location && <span>📍 {schedule.location}</span>}
                          <span className="schedule-status status-completed">已完成</span>
                        </div>
                        <div className="schedule-edit-hint">
                          ✏️ 点击编辑日程
                        </div>
                      </div>
                      <div className="schedule-actions">
                        <button
                          className="btn-ai-view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewAISuggestions(schedule);
                          }}
                          title="查看AI建议"
                        >
                          🤖
                        </button>
                        <button
                          className="btn-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchedule(schedule.id);
                          }}
                          title="删除日程"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* AI建议历史查看模态框 */}
        {showAISuggestions && selectedSchedule && (
          <div className="modal-overlay" onClick={closeAISuggestionsModal}>
            <div className="modal-content ai-suggestions-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🤖 AI规划建议 - {selectedSchedule.title}</h2>
                <button className="modal-close" onClick={closeAISuggestionsModal}>
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                {loadingSuggestions ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>加载中...</p>
                  </div>
                ) : scheduleSuggestions.length === 0 ? (
                  <div className="empty-suggestions">
                    <p>📭 暂无AI规划建议</p>
                    <p className="hint">在添加日程时使用"AI智能规划"功能，建议将自动保存</p>
                  </div>
                ) : (
                  <div className="suggestions-list">
                    {scheduleSuggestions.map((suggestion) => {
                      const parsed = parseAISuggestionContent(suggestion.content);
                      const metadata = suggestion.metadata || null;
                      
                      return (
                        <div key={suggestion.id} className="suggestion-item">
                          <div className="suggestion-header">
                            <span className="suggestion-type">
                              {suggestion.suggestionType === 'planning' ? '🧠 智能规划' : '📋 建议'}
                            </span>
                            <span className="suggestion-time">
                              {formatDate(suggestion.createdAt)}
                            </span>
                          </div>
                          
                          {parsed ? (
                            <div className="planning-result">
                              {parsed.overallAnalysis && (
                                <div className="analysis-section">
                                  <h4>📊 整体分析</h4>
                                  <p>{parsed.overallAnalysis}</p>
                                </div>
                              )}
                              
                              {parsed.prioritySuggestion && (
                                <div className="priority-section">
                                  <h4>🎯 优先级建议: <span className={`priority-${parsed.prioritySuggestion}`}>{parsed.prioritySuggestion}</span></h4>
                                  {parsed.priorityReason && <p>{parsed.priorityReason}</p>}
                                </div>
                              )}
                              
                              {parsed.suggestedTimes && parsed.suggestedTimes.length > 0 && (
                                <div className="suggested-times-section">
                                  <h4>⏰ 建议时间</h4>
                                  <div className="recommendation-list readonly">
                                    {parsed.suggestedTimes.map((slot, index) => (
                                      <div key={index} className="recommendation-item readonly">
                                        <div className="recommendation-time">
                                          📅 {formatDate(slot.startTime)} - {formatDate(slot.endTime)}
                                        </div>
                                        <div className="recommendation-reason">{slot.reason}</div>
                                        <div className="recommendation-score">推荐度: {(slot.score * 100).toFixed(0)}%</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {parsed.coordination && (
                                <div className="coordination-section">
                                  <h4>🔄 协调建议</h4>
                                  <p>{parsed.coordination}</p>
                                </div>
                              )}
                              
                              {parsed.efficiencyTips && parsed.efficiencyTips.length > 0 && (
                                <div className="tips-section">
                                  <h4>💡 效率建议</h4>
                                  <ul>
                                    {parsed.efficiencyTips.map((tip, index) => (
                                      <li key={index}>{tip}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="raw-content">
                              <p>{suggestion.content}</p>
                            </div>
                          )}
                          
                          {metadata && metadata.taskTitle && (
                            <div className="suggestion-metadata">
                              <small>原任务: {metadata.taskTitle}</small>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 编辑日程模态框 */}
        {showEditForm && editingSchedule && (
          <div className="modal-overlay" onClick={closeEditForm}>
            <div className="modal-content edit-schedule-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>✏️ 编辑日程</h2>
                <button className="modal-close" onClick={closeEditForm}>
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSaveEdit} className="edit-form">
                <div className="form-group">
                  <label htmlFor="edit-title">标题</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-description">描述</label>
                  <textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit-startTime">开始时间</label>
                    <input
                      id="edit-startTime"
                      type="datetime-local"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-endTime">结束时间</label>
                    <input
                      id="edit-endTime"
                      type="datetime-local"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-location">地点</label>
                  <input
                    id="edit-location"
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-priority">优先级</label>
                  <select
                    id="edit-priority"
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                  >
                    <option value="low">低优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="high">高优先级</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>

                {editConflicts.length > 0 && (
                  <div className="conflict-warning">
                    ⚠️ 时间冲突警告：与 {editConflicts.length} 个日程冲突
                    <div className="conflict-list">
                      {editConflicts.map((conflict) => (
                        <div key={conflict.id} className="conflict-item">
                          • {conflict.title} ({formatDate(conflict.startTime)} - {formatDate(conflict.endTime)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn-save" disabled={editLoading}>
                    {editLoading ? '保存中...' : editConflicts.length > 0 ? '⚠️ 仍要保存' : '保存修改'}
                  </button>
                  <button type="button" className="btn-cancel" onClick={closeEditForm}>
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
