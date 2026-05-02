// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useGetDashboardSummary, 
  useGetHostStatusBreakdown, 
  useGetEventCategoryBreakdown,
  useGetRecentActivity,
  getGetDashboardSummaryQueryKey
} from "@workspace/omega-api-client-react";
import { Server, Activity, AlertTriangle, Clock } from "lucide-react";
import { PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: statusBreakdown, isLoading: loadingStatus } = useGetHostStatusBreakdown();
  const { data: categoryBreakdown, isLoading: loadingCategories } = useGetEventCategoryBreakdown();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity();

  const STATUS_COLORS = {
    online: "#00ff41",
    offline: "#ef4444",
    unknown: "#6b7280"
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warn": return "secondary";
      case "info": default: return "default";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time telemetry and network status.</p>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hosts</CardTitle>
              <Server className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold">{summary?.totalHosts || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Online Status</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-32" /> : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{summary?.onlineHosts || 0}</span>
                  <span className="text-sm text-muted-foreground">/ {summary?.totalHosts || 0} online</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-3xl font-bold text-secondary">
                  {summary?.avgLatencyMs ? `${Math.round(summary.avgLatencyMs)}ms` : "N/A"}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Events</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-3xl font-bold text-destructive">{summary?.recentEventsCount || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Breakdown */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle>Host Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {loadingStatus ? (
                  <div className="w-full h-full flex items-center justify-center"><Skeleton className="w-[200px] h-[200px] rounded-full" /></div>
                ) : !statusBreakdown || statusBreakdown.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="45%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                        isAnimationActive={false}
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.unknown} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '4px', fontFamily: 'monospace' }}
                        itemStyle={{ color: '#e5e7eb' }}
                        formatter={(value, name) => [value, name]}
                      />
                      <Legend 
                        iconType="circle" 
                        iconSize={10}
                        formatter={(value) => <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '12px' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle>Event Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {loadingCategories ? (
                  <div className="w-full h-full flex items-center justify-center"><Skeleton className="w-full h-full" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBreakdown || []} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle>Recent Activity Stream</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentActivity?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                No recent activity logged.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity?.map((event) => (
                  <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant={getSeverityColor(event.severity) as any} className="uppercase text-[10px]">
                        {event.severity}
                      </Badge>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span className="text-primary">[{event.category}]</span> 
                          {event.action}
                          {event.hostLabel && <span className="text-muted-foreground">on {event.hostLabel}</span>}
                        </div>
                        {event.details && <div className="text-xs text-muted-foreground mt-1 truncate max-w-[300px] md:max-w-md">{event.details}</div>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap mt-2 sm:mt-0 font-mono">
                      {format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}