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
  timeSlot: "morning" | "afternoon";
  assignedArea: string;
  adjacentAreas: string[];
  eventId: string;
  isActive: boolean;
  validDate: Date;
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
  distributedAt?: Date;
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
  availableTime: "morning" | "afternoon" | "both";
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