
export interface ClickUpConfig {
  apiToken: string;
  workspaceId: string;
  listId: string;
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
  suggestedTags: string[];
  categories: {
    name: string;
    details: string[];
  }[];
  acceptanceCriteria: AcceptanceCriterion[];
  keynoteSlides: {
    title: string;
    content: string[];
  }[];
  followUpQuestions: string[];
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
