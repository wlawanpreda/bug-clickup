
import { Workspace, List, ClickUpTask, ClickUpStatus, ClickUpComment, ClickUpCustomField } from '../types';

const BASE_URL = 'https://api.clickup.com/api/v2';

export const clickUpService = {
  getWorkspaces: async (token: string): Promise<Workspace[]> => {
    const response = await fetch(`${BASE_URL}/team`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to fetch workspaces');
    const data = await response.json();
    return data.teams.map((t: any) => ({ id: t.id, name: t.name }));
  },

  getAllLists: async (token: string, teamId: string): Promise<List[]> => {
    const spacesRes = await fetch(`${BASE_URL}/team/${teamId}/space`, {
      headers: { Authorization: token },
    });
    const spacesData = await spacesRes.json();
    const lists: List[] = [];

    for (const space of spacesData.spaces) {
      const folderlessRes = await fetch(`${BASE_URL}/space/${space.id}/list`, {
        headers: { Authorization: token },
      });
      const folderlessData = await folderlessRes.json();
      lists.push(...folderlessData.lists.map((l: any) => ({ id: l.id, name: `${space.name} > ${l.name}` })));

      const foldersRes = await fetch(`${BASE_URL}/space/${space.id}/folder`, {
        headers: { Authorization: token },
      });
      const foldersData = await foldersRes.json();
      for (const folder of foldersData.folders) {
        const folderListsRes = await fetch(`${BASE_URL}/folder/${folder.id}/list`, {
          headers: { Authorization: token },
        });
        const folderListsData = await folderListsRes.json();
        lists.push(...folderListsData.lists.map((l: any) => ({ id: l.id, name: `${space.name} > ${folder.name} > ${l.name}` })));
      }
    }
    return lists;
  },

  getCustomFields: async (token: string, listId: string): Promise<ClickUpCustomField[]> => {
    const response = await fetch(`${BASE_URL}/list/${listId}/field`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to fetch custom fields');
    const data = await response.json();
    return data.fields;
  },

  setCustomFieldValue: async (token: string, taskId: string, fieldId: string, value: any) => {
    const response = await fetch(`${BASE_URL}/task/${taskId}/field/${fieldId}`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) throw new Error('Failed to set custom field value');
    return response.json();
  },

  getTasks: async (token: string, listId: string): Promise<ClickUpTask[]> => {
    const allTasks: ClickUpTask[] = [];
    let page = 0;
    let lastPageReached = false;

    while (!lastPageReached && page < 20) { 
      const response = await fetch(`${BASE_URL}/list/${listId}/task?include_closed=true&page=${page}&limit=100`, {
        headers: { Authorization: token },
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      
      if (data.tasks && data.tasks.length > 0) {
        allTasks.push(...data.tasks);
        if (data.tasks.length < 100) {
          lastPageReached = true;
        } else {
          page++;
        }
      } else {
        lastPageReached = true;
      }
    }
    return allTasks;
  },

  getTaskDetails: async (token: string, taskId: string): Promise<ClickUpTask> => {
    const response = await fetch(`${BASE_URL}/task/${taskId}?subtasks=true`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to fetch task details');
    return response.json();
  },

  getTaskComments: async (token: string, taskId: string): Promise<ClickUpComment[]> => {
    let allComments: ClickUpComment[] = [];
    let before: string | null = null;
    let hasMore = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // Fetch up to 2000 comments
    const REQUEST_LIMIT = 100;

    while (hasMore && attempts < MAX_ATTEMPTS) {
      attempts++;
      const url = `${BASE_URL}/task/${taskId}/comment?limit=${REQUEST_LIMIT}${before ? `&before=${before}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: token },
      });
      
      if (!response.ok) break;
      
      const data = await response.json();
      const fetched = data.comments || [];
      
      if (fetched.length > 0) {
        allComments = [...allComments, ...fetched];
        const oldestComment = fetched[fetched.length - 1];
        before = oldestComment.date;

        // In ClickUp, if we get fewer than we asked for, we've likely reached the end.
        // However, some configurations might ignore limit=100 and return default 25.
        // So we only stop if fetched.length is small (e.g., < 25).
        if (fetched.length >= 25) {
          hasMore = true;
        } else {
          hasMore = false;
        }
        
        // Safety: If the last date hasn't changed, stop to avoid infinite loop
        if (attempts > 1 && allComments.length > fetched.length && allComments[allComments.length - fetched.length - 1].date === before) {
            hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    // Remove duplicates by ID
    const uniqueMap = new Map<string, ClickUpComment>();
    allComments.forEach(c => uniqueMap.set(c.id, c));
    const uniqueList = Array.from(uniqueMap.values());

    // Sort by date descending (newest first)
    return uniqueList.sort((a, b) => parseInt(b.date) - parseInt(a.date));
  },

  addTaskComment: async (token: string, taskId: string, text: string) => {
    const response = await fetch(`${BASE_URL}/task/${taskId}/comment`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment_text: text }),
    });
    if (!response.ok) throw new Error('Failed to add comment');
    return response.json();
  },

  addReaction: async (token: string, commentId: string, reaction: string) => {
    const response = await fetch(`${BASE_URL}/comment/${commentId}/reaction`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reaction }),
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({ err: 'Unknown error' }));
      console.error('ClickUp Reaction Error Details:', JSON.stringify(err, null, 2));
      throw new Error(err.err || 'Failed to add reaction');
    }
    
    return response.status === 204 ? {} : response.json().catch(() => ({}));
  },

  getListStatuses: async (token: string, listId: string): Promise<ClickUpStatus[]> => {
    const response = await fetch(`${BASE_URL}/list/${listId}`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to fetch list details');
    const data = await response.json();
    return data.statuses;
  },

  updateTask: async (token: string, taskId: string, data: { status?: string, name?: string, description?: string, markdown_description?: string, assignees?: number[] }) => {
    const response = await fetch(`${BASE_URL}/task/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },

  createTask: async (token: string, listId: string, title: string, markdownDescription: string, priority?: number) => {
    const response = await fetch(`${BASE_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title,
        markdown_description: markdownDescription,
        status: 'to do',
        priority: priority || 3,
      }),
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },

  createSubtask: async (token: string, parentTaskId: string, title: string, markdownDescription: string, priority?: number) => {
    // We need to find the listId of the parent task first
    const parentResponse = await fetch(`${BASE_URL}/task/${parentTaskId}`, {
      headers: { Authorization: token },
    });
    if (!parentResponse.ok) throw new Error('Failed to fetch parent task details');
    const parentData = await parentResponse.json();
    const listId = parentData.list.id;

    const response = await fetch(`${BASE_URL}/list/${listId}/task`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title,
        markdown_description: markdownDescription,
        parent: parentTaskId,
        status: 'to do',
        priority: priority || 3,
      }),
    });
    if (!response.ok) throw new Error('Failed to create subtask');
    return response.json();
  },

  deleteTask: async (token: string, taskId: string) => {
    const response = await fetch(`${BASE_URL}/task/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
  },

  getListMembers: async (token: string, listId: string) => {
    const response = await fetch(`${BASE_URL}/list/${listId}/member`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Failed to fetch list members');
    const data = await response.json();
    return data.members || [];
  },

  uploadAttachment: async (token: string, taskId: string, base64Data: string) => {
    const base64Parts = base64Data.split(',');
    const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const binaryData = atob(base64Parts[1]);
    const array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      array[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([array], { type: mimeType });

    const formData = new FormData();
    formData.append('attachment', blob, `Preview-Bug-Report-${Date.now()}.png`);

    const response = await fetch(`${BASE_URL}/task/${taskId}/attachment`, {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload attachment');
    return response.json();
  }
};
