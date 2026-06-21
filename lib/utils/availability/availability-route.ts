type MinimalDashboardData = {
  event: unknown;
  totalTeams: number;
  totalMembers: number;
  totalResponses?: number;
  availableResponses?: number;
  totalAreas: number;
};

type MinimalDashboardResult = {
  event: unknown;
  stats: {
    totalTeams: number;
    totalMembers: number;
    totalResponses: number;
    availableResponses: number;
    totalAreas: number;
    isMinimal: true;
  };
  teams: [];
  performance: {
    responseTime: number;
    dataFreshnessTime: string;
    isMinimalResponse: true;
  };
  loadingStrategy: {
    nextEndpoint: string;
    chunkSize: number;
    totalItems: number;
  };
};

export function buildMinimalDashboardResponseData(
  year: string,
  data: MinimalDashboardData,
  responseTime: number,
  now = new Date().toISOString(),
): MinimalDashboardResult {
  return {
    event: data.event,
    stats: {
      totalTeams: data.totalTeams,
      totalMembers: data.totalMembers,
      totalResponses: data.totalResponses || data.totalMembers,
      availableResponses: data.availableResponses || 0,
      totalAreas: data.totalAreas,
      isMinimal: true,
    },
    teams: [],
    performance: {
      responseTime,
      dataFreshnessTime: now,
      isMinimalResponse: true,
    },
    loadingStrategy: {
      nextEndpoint: `/api/admin/dashboard/${year}/progressive`,
      chunkSize: 10,
      totalItems: data.totalTeams,
    },
  };
}
