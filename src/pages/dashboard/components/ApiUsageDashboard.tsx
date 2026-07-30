import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiUsageRecords, saveApiUsageRecord, clearApiUsageRecords, ApiUsageRecord } from "@/lib/storage/api-usage";
import { getPricingForModel, USD_TO_INR_RATE, API_PRICING } from "@/config/pricing.constants";
import { IndianRupee, PlusIcon, Trash2Icon, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ApiUsageDashboard = () => {
  const [records, setRecords] = useState<ApiUsageRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [pastModel, setPastModel] = useState<string>("gemini-3.5-flash");
  const [pastInputTokens, setPastInputTokens] = useState<number>(0);
  const [pastOutputTokens, setPastOutputTokens] = useState<number>(0);

  const loadRecords = () => {
    setRecords(getApiUsageRecords());
  };

  useEffect(() => {
    loadRecords();
    
    // Listen for cross-window updates
    const handleUpdate = () => loadRecords();
    window.addEventListener("api-usage-updated", handleUpdate);
    return () => window.removeEventListener("api-usage-updated", handleUpdate);
  }, []);

  const stats = useMemo(() => {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCostUSD = 0;

    const byModel: Record<string, { input: number; output: number; costUSD: number }> = {};

    records.forEach((record) => {
      totalInput += record.inputTokens;
      totalOutput += record.outputTokens;

      const pricing = getPricingForModel(record.modelId);
      const cost = 
        (record.inputTokens / 1_000_000) * pricing.pricePer1MInputUSD +
        (record.outputTokens / 1_000_000) * pricing.pricePer1MOutputUSD;

      totalCostUSD += cost;

      if (!byModel[record.modelId]) {
        byModel[record.modelId] = { input: 0, output: 0, costUSD: 0 };
      }
      byModel[record.modelId].input += record.inputTokens;
      byModel[record.modelId].output += record.outputTokens;
      byModel[record.modelId].costUSD += cost;
    });

    return { totalInput, totalOutput, totalCostUSD, byModel };
  }, [records]);

  const handleAddPastUsage = () => {
    if (pastInputTokens > 0 || pastOutputTokens > 0) {
      saveApiUsageRecord({
        modelId: pastModel,
        inputTokens: pastInputTokens,
        outputTokens: pastOutputTokens,
      });
      loadRecords();
      setIsAddModalOpen(false);
      setPastInputTokens(0);
      setPastOutputTokens(0);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all API usage history?")) {
      clearApiUsageRecords();
      loadRecords();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Usage & Billing</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track your local API key token consumption and estimated costs.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Past Usage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Historical Usage</DialogTitle>
                <DialogDescription>
                  Enter token usage from before you installed this update to keep your total cost accurate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={pastModel} onValueChange={setPastModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {API_PRICING.filter(p => p.modelId !== 'default').map((p) => (
                        <SelectItem key={p.modelId} value={p.modelId}>
                          {p.modelId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Input Tokens</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={pastInputTokens || ""}
                      onChange={(e) => setPastInputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Output Tokens</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={pastOutputTokens || ""}
                      onChange={(e) => setPastOutputTokens(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <Button className="w-full mt-2" onClick={handleAddPastUsage}>
                  Save Past Usage
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={handleClearHistory} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <Trash2Icon className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost (INR)</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(stats.totalCostUSD * USD_TO_INR_RATE).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on ${stats.totalCostUSD.toFixed(4)} USD total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <div className="h-4 w-4 text-muted-foreground rounded-full border flex items-center justify-center text-[10px] font-bold">T</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.totalInput + stats.totalOutput).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Input: {stats.totalInput.toLocaleString()} | Output: {stats.totalOutput.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Live Tracking Active</CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xs text-primary/80 mt-2 leading-relaxed">
              New usage is tracked automatically when you use the AI. 
              Costs are estimated based on public API rates.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown by Model</CardTitle>
          <CardDescription>View token usage and estimated cost for each specific AI model.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-md">Model</th>
                  <th className="px-4 py-3 text-right">Input Tokens</th>
                  <th className="px-4 py-3 text-right">Output Tokens</th>
                  <th className="px-4 py-3 text-right">Cost (USD)</th>
                  <th className="px-4 py-3 text-right rounded-tr-md">Cost (INR)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(stats.byModel).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No API usage recorded yet.
                    </td>
                  </tr>
                ) : (
                  Object.entries(stats.byModel).map(([modelId, data]) => (
                    <tr key={modelId} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium">{modelId}</td>
                      <td className="px-4 py-3 text-right">{data.input.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{data.output.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">${data.costUSD.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-medium">₹{(data.costUSD * USD_TO_INR_RATE).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
