import { useState, useEffect } from 'react';
import { authService } from './services/authService';
import { scheduleService } from './services/scheduleService';
import { aiService } from './services/aiService';
import type { Schedule, CreateScheduleData, User, ScheduleStats, TimeRecommendation, AIConfig, AIPlanningResult, AISuggestion, GeneratePlanResult, PlanningHistoryItem } from './types';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showLogin, setShowLogin] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [recommendations, setRecommendations] = useState<TimeRecommendation | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiConfigForm, setAiConfigForm] = useState<AIConfig>({
    aiApiKey: '',
    aiApiBaseUrl: '',
    aiModel: '',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);
  const [hasAIConfig, setHasAIConfig] = useState(false);
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

  // 登录/注册表单
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  // 获取当前时间和1小时后的时间(datetime-local格式)
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30); // 向上取整到最近的30分钟
    return now.toISOString().slice(0, 16);
  };

  const getDefaultEndTime = () => {
    const later = new Date();
    later.setMinutes(Math.ceil(later.getMinutes() / 30) * 30);
    later.setHours(later.getHours() + 1); // 默认1小时后
    return later.toISOString().slice(0, 16);
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
      // 加载用户的AI配置
      setAiConfigForm({
        aiApiKey: userData.aiApiKey || '',
        aiApiBaseUrl: userData.aiApiBaseUrl || '',
        aiModel: userData.aiModel || '',
      });
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

  // 检查AI配置状态
  const checkAIStatus = async () => {
    try {
      const status = await aiService.getAIStatus();
      setHasAIConfig(status.hasAIConfig);
    } catch (error) {
      console.error('检查AI状态失败:', error);
      setHasAIConfig(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkAIStatus();
    }
  }, [isAuthenticated, user]);

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
    const start = new Date(startTime).toISOString().slice(0, 16);
    const end = new Date(endTime).toISOString().slice(0, 16);
    setScheduleForm({
      ...scheduleForm,
      startTime: start,
      endTime: end,
    });
    setShowAIPlanning(false);
  };

  const applyRecommendation = (startTime: string, endTime: string) => {
    const start = new Date(startTime).toISOString().slice(0, 16);
    const end = new Date(endTime).toISOString().slice(0, 16);
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

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccess(false);
    try {
      const updatedUser = await authService.updateAIConfig(aiConfigForm);
      setUser(updatedUser);
      setConfigSuccess(true);
      setTimeout(() => {
        setShowAIConfig(false);
        setConfigSuccess(false);
      }, 2000);
    } catch (error: any) {
      alert(error.response?.data?.error?.message || '保存失败');
    } finally {
      setConfigSaving(false);
    }
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
      startTime: new Date(schedule.startTime).toISOString().slice(0, 16),
      endTime: new Date(schedule.endTime).toISOString().slice(0, 16),
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
          <button
            className={`btn-history ${showHistorySidebar ? 'active' : ''}`}
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            title="规划历史"
          >
            📜 规划历史 {historyTotal > 0 && `(${historyTotal})`}
          </button>
          <span>欢迎, {user?.name}</span>
          <button className="btn-settings" onClick={() => setShowAIConfig(true)}>
            ⚙️ AI配置
          </button>
          <button onClick={handleLogout}>退出</button>
        </div>
      </header>

      {showAIConfig && (
        <div className="modal-overlay" onClick={() => setShowAIConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI 配置</h2>
              <button className="modal-close" onClick={() => setShowAIConfig(false)}>
                ×
              </button>
            </div>
            {configSuccess && (
              <div className="success-message">
                ✅ AI配置保存成功！
              </div>
            )}
            <form onSubmit={handleSaveAIConfig} className="config-form">
              <div className="form-group">
                <label htmlFor="apiKey">API 密钥</label>
                <input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={aiConfigForm.aiApiKey}
                  onChange={(e) => setAiConfigForm({ ...aiConfigForm, aiApiKey: e.target.value })}
                />
                <small>输入你的 OpenAI 兼容 API 密钥</small>
              </div>
              <div className="form-group">
                <label htmlFor="apiBaseUrl">API 基础URL (可选)</label>
                <input
                  id="apiBaseUrl"
                  type="url"
                  placeholder="https://api.openai.com/v1"
                  value={aiConfigForm.aiApiBaseUrl}
                  onChange={(e) => setAiConfigForm({ ...aiConfigForm, aiApiBaseUrl: e.target.value })}
                />
                <small>留空使用默认 OpenAI API，或填写其他兼容服务的地址</small>
              </div>
              <div className="form-group">
                <label htmlFor="apiModel">模型名称 (可选)</label>
                <input
                  id="apiModel"
                  type="text"
                  placeholder="gpt-4-turbo-preview"
                  value={aiConfigForm.aiModel}
                  onChange={(e) => setAiConfigForm({ ...aiConfigForm, aiModel: e.target.value })}
                />
                <small>指定使用的AI模型，留空使用默认模型</small>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-save" disabled={configSaving}>
                  {configSaving ? '保存中...' : '保存配置'}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAIConfig(false)}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="app-main">
        {stats && (
          <div className="stats-panel">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">总日程</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.today}</div>
              <div className="stat-label">今日</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.thisWeek}</div>
              <div className="stat-label">本周</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">待完成</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.highPriority}</div>
              <div className="stat-label">高优先级</div>
            </div>
          </div>
        )}

        <div className="schedule-header">
          <h2>我的日程 ({schedules.length})</h2>
          <div className="header-buttons">
            <button
              className="btn-smart-plan"
              onClick={() => {
                if (!hasAIConfig) {
                  const confirmed = confirm('使用智能科学规划功能需要先配置AI密钥。是否现在配置？');
                  if (confirmed) {
                    setShowAIConfig(true);
                  }
                  return;
                }
                setShowSmartPlanning(true);
              }}
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
                        {!hasAIConfig && (
                          <button
                            className="btn-settings-small"
                            onClick={() => {
                              closeSmartPlanning();
                              setShowAIConfig(true);
                            }}
                          >
                            配置AI密钥
                          </button>
                        )}
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
              {hasAIConfig && (
                <button
                  type="button"
                  className="btn-ai-planning"
                  onClick={handleAIPlanning}
                  disabled={planningLoading || !scheduleForm.title}
                >
                  {planningLoading ? '⏳ 分析中...' : '🧠 AI智能规划'}
                </button>
              )}
              {!hasAIConfig && (
                <span className="ai-config-hint">
                  💡 <a href="#" onClick={(e) => { e.preventDefault(); setShowAIConfig(true); }}>配置AI密钥</a> 启用更智能的分析
                </span>
              )}
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
                      <button
                        className="btn-settings-small"
                        onClick={() => setShowAIConfig(true)}
                      >
                        配置AI密钥
                      </button>
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
          {schedules.length === 0 ? (
            <p className="empty-state">还没有日程,点击上方按钮添加吧!</p>
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="schedule-card">
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
                    <span className="schedule-status">{schedule.status}</span>
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
            ))
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
