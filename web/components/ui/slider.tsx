"use client";

import * as React from "react";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step,
  disabled = false,
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      disabled={disabled}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-blue-600"
    />
  );
}
