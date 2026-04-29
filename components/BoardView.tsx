
import React, { useEffect, useState, useCallback } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clickUpService } from '../services/clickUpService';
import { ClickUpConfig, ClickUpTask, ClickUpStatus, ClickUpComment, ClickUpReaction } from '../types';
import TaskDetailModal from './TaskDetailModal';

interface Props {
  config: ClickUpConfig;
  refreshTrigger: number;
}

interface TaskStats {
  total: number;
  tested: number;
  rejected: number;
  loading: boolean;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

// --- Sortable Task Card Component ---
interface SortableTaskCardProps {
  task: ClickUpTask;
  stats?: TaskStats;
  onClick: (id: string) => void;
}

const SortableTaskCard: React.FC<SortableTaskCardProps> = ({ task, stats, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const remaining = stats ? stats.total - (stats.tested + stats.rejected) : 0;
  const progress = stats && stats.total > 0 ? (stats.tested / stats.total) * 100 : 0;
  const isFullyPassed = stats && stats.total > 0 && stats.rejected === 0 && stats.tested > 0;
  const hasIssues = stats && stats.rejected > 0;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task.id)}
      className={`bg-white p-4 rounded-xl shadow-sm border transition-all duration-200 cursor-grab active:cursor-grabbing group relative overflow-hidden hover:scale-[1.02] hover:shadow-lg ${
        hasIssues 
          ? 'border-red-400 ring-2 ring-red-50' 
          : isFullyPassed 
            ? 'border-emerald-500 ring-2 ring-emerald-50' 
            : 'border-gray-200'
      }`}
    >
      {stats && !stats.loading && stats.total > 0 && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <div 
            className={`h-full transition-all duration-500 ${hasIssues ? 'bg-red-500' : isFullyPassed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      <div className="flex justify-between items-start mb-2 mt-1">
         <h4 className={`font-black text-base leading-tight transition ${hasIssues ? 'text-red-900' : isFullyPassed ? 'text-emerald-900' : 'text-gray-900 group-hover:text-indigo-700'}`}>{task.name}</h4>
         {task.priority && (
           <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0 ml-2" style={{ backgroundColor: task.priority.color + '20', color: task.priority.color }}>
             {task.priority.priority}
           </span>
         )}
      </div>
      
      {task.description && (
        <p className="text-[10px] text-gray-400 line-clamp-1 font-medium mb-3">{task.description}</p>
      )}

      <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1 pointer-events-none">
          {stats?.tested ? (
            <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-lg text-[9px] font-black shadow-sm">
              <span>✅</span>
              <span>{stats.tested}</span>
            </div>
          ) : null}

          {stats?.rejected ? (
            <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-lg text-[9px] font-black shadow-sm animate-pulse">
              <span>🚨</span>
              <span>{stats.rejected}</span>
            </div>
          ) : null}
          
          {remaining > 0 && !stats?.loading && (
            <div className="flex items-center gap-1 bg-gray-100 text-gray-400 border border-gray-200 px-2 py-1 rounded-lg text-[9px] font-black">
              <span>⏳</span>
              <span>{remaining}</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-[9px] font-black text-gray-400">
            <span>💬</span>
            <span>{stats?.total || 0}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-bold text-gray-300 pointer-events-none">#{task.id}</span>
          <div className="flex -space-x-2">
            {task.assignees?.slice(0, 3).map((u) => (
              <div 
                key={u.id} 
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm overflow-hidden"
                style={{ backgroundColor: u.color }}
                title={u.username}
              >
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt={u.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  u.initials
                )}
              </div>
            ))}
            {(task.assignees?.length || 0) > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-black text-gray-500 shadow-sm">
                +{(task.assignees?.length || 0) - 3}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BoardView: React.FC<Props> = ({ config, refreshTrigger }) => {
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [statuses, setStatuses] = useState<ClickUpStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState<Record<string, TaskStats>>({});
  const [localRefresh, setLocalRefresh] = useState(0);
  const [activeTask, setActiveTask] = useState<ClickUpTask | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isSuccessReaction = (r: ClickUpReaction) => {
    const name = r.reaction.toLowerCase();
    return (
      name === '✅' || 
      name === 'check' || 
      name === 'check_mark' || 
      name === 'white_check_mark' || 
      name === 'success' ||
      name.includes('success')
    );
  };

  const isIssueReaction = (r: ClickUpReaction) => {
    const name = r.reaction.toLowerCase();
    return (
      name === '❌' || 
      name === 'x' || 
      name === 'cancel' || 
      name === 'no_entry' || 
      name.includes('alert') || 
      name.includes('bug')
    );
  };

  // 🚨 Rejected (Bug/Issue): มีเครื่องหมายบัค และ ยังไม่ถูก Resolve หรือ ตรวจสอบผ่าน
  const checkCommentRejected = (c: ClickUpComment) => {
    const hasIssueMarkers = c.comment_text.includes('🚨') || 
                           c.comment_text.includes('❌') || 
                           c.reactions?.some(isIssueReaction);
    
    const isResolvedOrVerified = c.resolved === true || c.reactions?.some(isSuccessReaction);
    
    return hasIssueMarkers && !isResolvedOrVerified;
  };

  // ✅ Tested (Verified): ได้รับการกดติ๊กถูกยืนยันแล้ว
  const checkCommentTested = (c: ClickUpComment) => {
    return c.reactions?.some(isSuccessReaction);
  };

  const fetchTaskStats = useCallback(async (taskId: string) => {
    try {
      const comments = await clickUpService.getTaskComments(config.apiToken, taskId);
      
      const testedCount = comments.filter(checkCommentTested).length;
      const rejectedCount = comments.filter(checkCommentRejected).length;
      
      setTaskStats(prev => ({
        ...prev,
        [taskId]: {
          total: comments.length,
          tested: testedCount,
          rejected: rejectedCount,
          loading: false
        }
      }));
    } catch (err) {
      console.error(`Failed to fetch stats for task ${taskId}`, err);
    }
  }, [config.apiToken]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [taskData, statusData] = await Promise.all([
          clickUpService.getTasks(config.apiToken, config.listId),
          clickUpService.getListStatuses(config.apiToken, config.listId)
        ]);
        setTasks(taskData);
        setStatuses(statusData.sort((a, b) => a.orderindex - b.orderindex));

        const initialStats: Record<string, TaskStats> = {};
        taskData.forEach(t => {
          initialStats[t.id] = { total: t.comment_count || 0, tested: 0, rejected: 0, loading: true };
        });
        setTaskStats(initialStats);

        // Batch fetch stats to avoid rate limiting and browser connection limits
        const BATCH_SIZE = 5;
        for (let i = 0; i < taskData.length; i += BATCH_SIZE) {
          const batch = taskData.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(t => fetchTaskStats(t.id)));
          // Small delay between batches if needed, but fetchWithRetry already handles 429s
        }

      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลบอร์ดได้');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [config, refreshTrigger, localRefresh, fetchTaskStats]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.task;
    const isOverTask = over.data.current?.task;

    if (!isActiveTask) return;

    // Moving between columns
    if (isActiveTask && !isOverTask) {
      const overContainerId = over.id as string;
      const activeTask = tasks.find(t => t.id === activeId);
      
      if (activeTask && activeTask.status.status.toLowerCase() !== overContainerId.toLowerCase()) {
        setTasks((prev) => {
          return prev.map(t => {
            if (t.id === activeId) {
              return { ...t, status: { ...t.status, status: overContainerId } };
            }
            return t;
          });
        });
      }
    }

    // Swapping or moving to a different column but over a task
    if (isActiveTask && isOverTask) {
      const activeTask = tasks.find(t => t.id === activeId);
      const overTask = tasks.find(t => t.id === overId);

      if (activeTask && overTask && activeTask.status.status.toLowerCase() !== overTask.status.status.toLowerCase()) {
        setTasks((prev) => {
          return prev.map(t => {
            if (t.id === activeId) {
              return { ...t, status: { ...overTask.status } };
            }
            return t;
          });
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // If it moved to a different column or changed position
    const oldIndex = tasks.findIndex(t => t.id === activeId);
    const newIndex = tasks.findIndex(t => t.id === overId);

    if (oldIndex !== newIndex) {
      setTasks((items) => arrayMove(items, oldIndex, newIndex));
    }

    // Update ClickUp status if it changed
    // We get the final status from the local state which was updated in onDragOver
    const finalTaskState = tasks.find(t => t.id === activeId);
    if (finalTaskState) {
      try {
        await clickUpService.updateTask(config.apiToken, activeId.toString(), {
          status: finalTaskState.status.status
        });
      } catch (err) {
        console.error("Failed to update ClickUp task status:", err);
        setError("ไม่สามารถอัปเดตสถานะใน ClickUp ได้");
        setLocalRefresh(prev => prev + 1); // Revert UI
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-gray-500">กำลังดึงข้อมูลบอร์ด...</p>
    </div>
  );

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-xl font-bold border border-red-200">{error}</div>;

  const filteredTasks = tasks.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="ค้นหางาน (Press / หรือ Ctrl+K)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm font-bold outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-gray-400 uppercase">Filters:</span>
           <button className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black text-gray-500 hover:bg-gray-100 transition">ALL</button>
           <button className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-[10px] font-black text-gray-300 transition cursor-not-allowed">MY TASKS</button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto p-6 pb-8 scrollbar-hide flex-1">
          {statuses.map((status) => {
            const statusTasks = filteredTasks.filter(t => t.status.status.toLowerCase() === status.status.toLowerCase());
          return (
            <div key={status.status} className="flex-shrink-0 w-80 flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}></span>
                  <h3 className="font-black text-gray-900 uppercase text-sm tracking-widest">{status.status}</h3>
                  <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{statusTasks.length}</span>
                </div>
              </div>

              <SortableContext 
                id={status.status}
                items={statusTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div 
                  className="bg-gray-100/50 p-3 rounded-2xl flex flex-col gap-3 min-h-[200px] border border-gray-200 shadow-inner"
                >
                  {statusTasks.length === 0 ? (
                    <div className="text-center py-10 text-xs font-bold text-gray-400 italic">ไม่มีงานในสถานะนี้</div>
                  ) : (
                    statusTasks.map(task => (
                      <SortableTaskCard 
                        key={task.id} 
                        task={task} 
                        stats={taskStats[task.id]}
                        onClick={setSelectedTaskId}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}

        {selectedTaskId && (
          <TaskDetailModal 
            taskId={selectedTaskId} 
            config={config} 
            onClose={() => {
              setSelectedTaskId(null);
              setLocalRefresh(prev => prev + 1);
            }} 
          />
        )}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="w-80 shadow-2xl rotate-2 scale-105 opacity-90">
            <SortableTaskCard 
              task={activeTask} 
              stats={taskStats[activeTask.id]}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  </div>
);
};

export default BoardView;
