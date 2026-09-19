"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  date: string; // YYYY-MM-DD format
  onDateChange: (date: string) => void;
  placeholder?: string;
}

export function DatePicker({ date, onDateChange, placeholder = "Pick a date" }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(() => {
    const d = date ? new Date(date) : new Date();
    return d.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const d = date ? new Date(date) : new Date();
    return d.getMonth();
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();

  const handleDateSelect = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(day)}`;
    onDateChange(dateStr);
    setIsOpen(false);
  };

  const selectedDate = date ? new Date(date) : null;
  const displayText = selectedDate 
    ? format(selectedDate, "PPP")
    : placeholder;

  return (
    <div className="relative">
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !date && "text-muted-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {displayText}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-2 w-[280px] rounded-md border bg-popover p-3 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-sm font-medium border rounded px-2 py-1 bg-background"
              >
                {months.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm font-medium border rounded px-2 py-1 bg-background"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium mb-2">
              <div>Su</div>
              <div>Mo</div>
              <div>Tu</div>
              <div>We</div>
              <div>Th</div>
              <div>Fr</div>
              <div>Sa</div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const isSelected = selectedDate &&
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === selectedMonth &&
                  selectedDate.getFullYear() === selectedYear;
                
                const isToday = new Date().getDate() === day &&
                  new Date().getMonth() === selectedMonth &&
                  new Date().getFullYear() === selectedYear;

                return (
                  <button
                    key={day}
                    onClick={() => handleDateSelect(day)}
                    className={cn(
                      "h-8 w-8 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      isToday && !isSelected && "border border-primary"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
