export interface DistributionEvent {
  eventId: string;
  eventName: string;
  distributionDate: Date;
  year: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  teamId: string;
  teamCode: string;
  teamName: string;
  // 'both' は「全日」で、互換のため 'all' も許容
  timeSlot: "morning" | "afternoon" | "both" | "all" | "pr" | "other";
  assignedArea: string;
  adjacentAreas: string[];
  eventId: string;
  isActive: boolean;
  // Firestore Timestamp may arrive via API; accept several shapes
  validDate?:
    | Date
    | string
    | number
    | { _seconds: number; _nanoseconds?: number }
    | { toDate: () => Date }
    | null;
  createdAt: Date;
}

export interface Store {
  storeId: string;
  storeName: string;
  storeNameKana: string;
  address: string;
  addressKana: string;
  areaCode: string;
  distributionStatus: "pending" | "completed" | "failed" | "revisit";
  failureReason?: "absent" | "refused" | "closed" | "other";
  distributedCount: number;
  distributedBy: string;
  createdByTeamCode?: string;
  distributedAt?: Date;
  notes?: string;
  registrationMethod: "preset" | "manual";
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Area {
  areaId: string;
  areaCode: string;
  areaName: string;
  timeSlot: "morning" | "afternoon";
  description?: string;
  eventId: string;
  createdAt: Date;
}

export interface Member {
  memberId: string;
  name: string;
  section: string;
  grade: number;
  availableTime: "morning" | "afternoon" | "both" | "pr" | "other";
  teamId?: string;
  source: "csv" | "form";
  createdAt: Date;
}

export interface Admin {
  adminId: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export interface TempAccount {
  accountId: string;
  teamCode: string;
  tempEmail: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface AuthUser {
  uid: string;
  email?: string;
  teamCode?: string;
  teamId?: string;
  isAdmin: boolean;
  customClaims?: {
    teamCode?: string;
    teamId?: string;
    role?: "admin" | "team";
  };
}

export interface StoreFormData {
  storeName: string;
  address: string;
  distributionStatus: Store["distributionStatus"];
  failureReason?: Store["failureReason"];
  distributedCount: number;
  notes?: string;
}

export interface LoginFormData {
  teamCode: string;
}

export interface AdminLoginFormData {
  email: string;
  password: string;
}

// 年度別データ管理
export interface DistributionHistory {
  historyId: string;
  eventId: string;
  year: number;
  eventName: string;
  distributionDate: Date;
  totalStores: number;
  completedStores: number;
  failedStores: number;
  completionRate: number;
  teams: TeamHistory[];
  areas: AreaHistory[];
  createdAt: Date;
  archivedAt: Date;
}

export interface TeamHistory {
  teamId: string;
  teamCode: string;
  teamName: string;
  timeSlot: "morning" | "afternoon";
  assignedArea: string;
  adjacentAreas: string[];
  members: TeamMember[];
  totalStores: number;
  completedStores: number;
  completionRate: number;
  distributedStores: StoreDistributionRecord[];
}

export interface TeamMember {
  memberId: string;
  name: string;
  section: string;
  grade: number;
  role?: "leader" | "member";
  joinedAt: Date;
}

export interface AreaHistory {
  areaId: string;
  areaCode: string;
  areaName: string;
  timeSlot: "morning" | "afternoon";
  totalStores: number;
  completedStores: number;
  completionRate: number;
  assignedTeams: string[];
}

export interface StoreDistributionRecord {
  storeId: string;
  storeName: string;
  address: string;
  areaCode: string;
  distributionStatus: Store["distributionStatus"];
  failureReason?: Store["failureReason"];
  distributedCount: number;
  distributedBy: string;
  distributedAt: Date;
  teamMembers: string[];
  notes?: string;
}

// 年度別統計データ
export interface YearlyStats {
  year: number;
  eventName: string;
  totalEvents: number;
  totalStores: number;
  totalTeams: number;
  totalMembers: number;
  averageCompletionRate: number;
  bestPerformingTeam: {
    teamCode: string;
    teamName: string;
    completionRate: number;
  };
  distributionTrends: {
    date: Date;
    completedStores: number;
    totalStores: number;
  }[];
}

// 配布履歴フィルター
export interface DistributionFilter {
  year?: number;
  eventId?: string;
  teamCode?: string;
  areaCode?: string;
  timeSlot?: "morning" | "afternoon";
  completionRateMin?: number;
  completionRateMax?: number;
}
