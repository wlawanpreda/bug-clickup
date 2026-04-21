
export interface ClickUpConfig {
  apiToken: string;
  workspaceId: string;
  listId: string;
  recentBoards?: RecentBoard[];
}

export interface RecentBoard {
  listId: string;
  workspaceId: string;
  name: string;
  lastUsed: string;
}

export interface ClickUpStatus {
  status: string;
  color: string;
  orderindex: number;
}

export interface ClickUpCustomFieldOption {
  id: string;
  name: string;
  color?: string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config: {
    options?: ClickUpCustomFieldOption[];
    multiselect?: boolean;
  };
  value?: any;
}

export interface ClickUpAssignee {
  id: number;
  username: string;
  color: string;
  initials: string;
  profilePicture?: string;
}

export interface ClickUpReaction {
  user: {
    id: number;
    username: string;
  };
  reaction: string; // Emoji name or unicode
}

export interface ClickUpComment {
  id: string;
  comment_text: string;
  user: {
    id: number;
    username: string;
    initials: string;
    color: string;
  };
  resolved: boolean;
  assignee?: {
    id: number;
    username: string;
  };
  reactions: ClickUpReaction[];
  date: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
  };
  description?: string;
  markdown_description?: string;
  priority?: {
    priority: string;
    color: string;
  };
  assignees?: ClickUpAssignee[];
  comment_count?: number;
  url?: string;
  subtasks?: ClickUpTask[];
  date_created?: string;
  date_updated?: string;
  list?: {
    id: string;
    name: string;
  };
}

export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

export interface SystemAnalysis {
  topic: string;
  system: 'business' | 'backoffice' | 'advertising funnel' | 'salehere' | 'other';
  feature: string;
  priorityLabel: 'Urgent' | 'High' | 'Normal' | 'Low';
  priorityLevel: number; // ClickUp mapping: 1=Urgent, 2=High, 3=Normal, 4=Low
  storyPoints: number;
  suggestedTags: string[];
  categories: {
    name: string; // e.g., "UI/UX Design", "Backend Development"
    details: string[];
  }[];
  acceptanceCriteria: AcceptanceCriterion[];
  definitionOfDone: string[];
  refinedPurpose?: string;
}

export interface BugReportResult {
  markdown: string;
  summary: string;
}

export interface Workspace {
  id: string;
  name: string;
}

export interface List {
  id: string;
  name: string;
}
