import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { PromptTemplate, getCustomPrompts, saveCustomPrompts } from "@/lib/platform-instructions";

export const CustomPersonas = () => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  useEffect(() => {
    setPrompts(getCustomPrompts());
  }, []);

  const handleAdd = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const newTemplate: PromptTemplate = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      prompt: newPrompt.trim(),
    };
    const updated = [...prompts, newTemplate];
    setPrompts(updated);
    saveCustomPrompts(updated);
    setNewName("");
    setNewPrompt("");
  };

  const handleDelete = (id: string) => {
    const updated = prompts.filter((p) => p.id !== id);
    setPrompts(updated);
    saveCustomPrompts(updated);
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl">Custom Prompts</CardTitle>
        <CardDescription>
          Create your own custom personas and system prompts. They will appear in the Persona dropdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Persona Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Expert Cloud Architect"
              className="bg-background/50 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label>System Prompt / Context</Label>
            <Textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="You are an expert... Here is my resume..."
              className="bg-background/50 border-white/10 min-h-[100px]"
            />
          </div>
          <Button onClick={handleAdd} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Custom Persona
          </Button>
        </div>

        {prompts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <Label>Your Custom Personas</Label>
            <div className="space-y-3">
              {prompts.map((p) => (
                <div key={p.id} className="p-3 rounded-md bg-white/5 border border-white/10 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {p.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
