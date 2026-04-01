"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Slider } from "./ui/slider";

export interface SettingsConfig {
  showSources: boolean;
  topK: number;
  temperature: number;
  maxTokens: number;
}

interface SettingsProps {
  settings: SettingsConfig;
  onSettingsChange: (settings: SettingsConfig) => void;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  showSources: true,
  topK: 5,
  temperature: 0.7,
  maxTokens: 500,
};

export function Settings({ settings, onSettingsChange }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
      >
        <SettingsIcon className="h-4 w-4" />
        <span>Settings</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogClose onClick={() => setOpen(false)} />
          <DialogHeader>
            <DialogTitle>Response Settings</DialogTitle>
            <DialogDescription className="text-gray-700">
              Adjust how the AI generates responses
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Show Sources */}
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Show Sources
                </label>
                <p className="text-xs text-gray-700 mt-1">
                  Display source references below responses
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.showSources}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      showSources: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Number of Sources */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-900">
                  Number of Sources
                </label>
                <span className="text-sm font-semibold text-blue-600">
                  {localSettings.topK}
                </span>
              </div>
              <Slider
                value={localSettings.topK}
                onValueChange={(value) =>
                  setLocalSettings({ ...localSettings, topK: value })
                }
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-gray-700 mt-1">
                How many sources to retrieve and use in the answer
              </p>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-900">
                  Temperature
                </label>
                <span className="text-sm font-semibold text-blue-600">
                  {localSettings.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={localSettings.temperature}
                onValueChange={(value) =>
                  setLocalSettings({ ...localSettings, temperature: value })
                }
                min={0}
                max={1}
                step={0.1}
                disabled
              />
              <p className="text-xs text-gray-700 mt-1">
                Controls creativity (lower = more focused, higher = more
                creative) - Coming soon
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-900">
                  Max Response Length
                </label>
                <span className="text-sm font-semibold text-blue-600">
                  {localSettings.maxTokens}
                </span>
              </div>
              <Slider
                value={localSettings.maxTokens}
                onValueChange={(value) =>
                  setLocalSettings({ ...localSettings, maxTokens: value })
                }
                min={100}
                max={1000}
                step={50}
                disabled
              />
              <p className="text-xs text-gray-700 mt-1">
                Maximum length of generated responses - Coming soon
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-gray-400 text-gray-900 hover:bg-gray-100 hover:border-gray-500"
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
