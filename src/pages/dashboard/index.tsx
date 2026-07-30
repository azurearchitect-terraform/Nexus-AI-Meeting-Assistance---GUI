import { PageLayout } from "@/layouts";
import { ApiUsageDashboard } from "./components";
import { useEffect, useState } from "react";
import { getApiUsageRecords } from "@/lib/storage/api-usage";

const Dashboard = () => {
  const [hasCheckedHistory, setHasCheckedHistory] = useState(false);
  const [hasUsageHistory, setHasUsageHistory] = useState(true);

  useEffect(() => {
    // Check if user has any usage history
    const records = getApiUsageRecords();
    setHasUsageHistory(records.length > 0);
    setHasCheckedHistory(true);
  }, []);

  return (
    <PageLayout
      title="API Usage Dashboard"
      description="Track your token consumption and estimated costs across all AI models."
    >
      <div className="max-w-5xl mx-auto py-6">
        {hasCheckedHistory && !hasUsageHistory && (
          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">No Usage History Found</h3>
              <p className="text-sm text-primary/80 mt-1">
                If you have been using the API prior to this update, you can add your past usage manually 
                to keep your total cost accurate. Otherwise, tracking will start automatically from now on.
              </p>
            </div>
            <div className="text-sm font-medium text-primary bg-background px-3 py-1.5 rounded-full border border-primary/20 shrink-0">
              Tip: Use the "Add Past Usage" button below
            </div>
          </div>
        )}
        
        <ApiUsageDashboard />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
