import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { saveAs } from 'file-saver'; // Needs: npm install file-saver

// --- Constants ---
const LOCAL_STORAGE_KEYS = {
    COMPLETED_DAYS: 'completedDays',
    CURRENT_DATE: 'currentDate',
    IS_DARK_MODE: 'isDarkMode',
    MONTHLY_NOTES: 'monthlyNotes',
};

// --- Custom Hooks ---

/**
 * Custom hook for managing state synchronized with localStorage.
 * Handles JSON serialization/deserialization.
 */
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (key === LOCAL_STORAGE_KEYS.CURRENT_DATE && item) {
                if (item && !isNaN(new Date(item))) {
                    return item;
                }
                console.warn(`Invalid date string found in localStorage for ${key}:`, item);
                return initialValue instanceof Date ? initialValue.toISOString() : initialValue;
            }
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue instanceof Date ? initialValue.toISOString() : initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

/**
 * Custom hook encapsulating all calendar logic, state, and statistics.
 */
function useCalendar() {
    // State Initialization
    const [currentDateISO, setCurrentDateISO] = useLocalStorage(LOCAL_STORAGE_KEYS.CURRENT_DATE, new Date().toISOString());
    const [completedDays, setCompletedDays] = useLocalStorage(LOCAL_STORAGE_KEYS.COMPLETED_DAYS, {});
    const [monthlyNotes, setMonthlyNotes] = useLocalStorage(LOCAL_STORAGE_KEYS.MONTHLY_NOTES, {});

    const currentDate = useMemo(() => {
        const date = new Date(currentDateISO);
        return isNaN(date) ? new Date() : date;
    }, [currentDateISO]);
    const currentMonthKey = useMemo(() => `${currentDate.getFullYear()}-${zeroPad(currentDate.getMonth() + 1)}`, [currentDate]);

    // Calendar Grid Generation
    const generateCalendarDays = useCallback((date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        const days = [];

        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false, key: getDateKey(new Date(year, month - 1, prevMonthLastDay - i)) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true, key: getDateKey(new Date(year, month, i)) });
        }

        const gridEndOffset = 42 - days.length;
        for (let i = 1; i <= gridEndOffset; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, key: getDateKey(new Date(year, month + 1, i)) });
        }

        return days;
    }, []);

    const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate, generateCalendarDays]);

    // Navigation Functions
    const changeMonth = useCallback((offset) => {
        setCurrentDateISO(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset, 1);
            return newDate.toISOString();
        });
    }, [setCurrentDateISO]);

    const changeYear = useCallback((offset) => {
        setCurrentDateISO(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(newDate.getFullYear() + offset);
            return newDate.toISOString();
        });
    }, [setCurrentDateISO]);

    const goToToday = useCallback(() => {
        setCurrentDateISO(new Date().toISOString());
    }, [setCurrentDateISO]);

    // Completion Statistics Calculation
     const stats = useMemo(() => {
        const sortedDates = Object.keys(completedDays).filter(key => completedDays[key]).sort();
        const currentMonthDays = calendarDays.filter(d => d.isCurrentMonth);
        const totalDaysInMonth = currentMonthDays.length;
        const completedInMonth = currentMonthDays.filter(d => completedDays[d.key]).length;
        const monthlyPercentage = totalDaysInMonth > 0 ? ((completedInMonth / totalDaysInMonth) * 100).toFixed(0) : 0;


        if (sortedDates.length === 0) {
            return { currentStreak: 0, longestStreak: 0, monthlyPercentage: 0, completedInMonth: 0, totalDaysInMonth: totalDaysInMonth };
        }

        let longestStreak = 0;
        let currentOverallStreak = 0; // Tracks the streak ending on the last completed day
        let tempStreak = 1;

        longestStreak = 1;
        currentOverallStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const currentDate = new Date(sortedDates[i]);
            const lastDate = new Date(sortedDates[i - 1]);
            currentDate.setUTCHours(0, 0, 0, 0);
            lastDate.setUTCHours(0, 0, 0, 0);
            const diffTime = currentDate - lastDate;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                tempStreak++;
            } else if (diffDays > 1) { // Only reset if the gap is more than 1 day
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
            // If diffDays is 0 or negative (shouldn't happen with sorted keys), ignore.
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        currentOverallStreak = tempStreak;

        let finalCurrentStreak = 0;
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const lastCompletedDateStr = sortedDates[sortedDates.length - 1];

        const isLastDayToday = lastCompletedDateStr === getDateKey(today);
        const isLastDayYesterday = lastCompletedDateStr === getDateKey(yesterday);

        if (isLastDayToday || isLastDayYesterday) {
             finalCurrentStreak = currentOverallStreak;
        }


        return { currentStreak: finalCurrentStreak, longestStreak, monthlyPercentage, completedInMonth, totalDaysInMonth };
    }, [completedDays, calendarDays]);


    // Monthly Notes Handling
    const currentNote = monthlyNotes[currentMonthKey] || '';
    const updateNote = useCallback((note) => {
        setMonthlyNotes(prev => ({
            ...prev,
            [currentMonthKey]: note,
        }));
    }, [setMonthlyNotes, currentMonthKey]);

    return {
        currentDate, completedDays, setCompletedDays, calendarDays,
        changeMonth, changeYear, goToToday, stats,
        currentNote, updateNote, monthlyNotes, setMonthlyNotes
    };
}

// --- Helper Functions ---
const zeroPad = (n) => n.toString().padStart(2, '0');

const getDateKey = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';
    try {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}-${zeroPad(month)}-${zeroPad(day)}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return '';
    }
};

const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
};

// --- React Components ---
const CalendarHeader = ({ currentDate, onPrevYear, onNextYear, onPrevMonth, onNextMonth, onGoToToday }) => {
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    return (
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-1 sm:space-x-2">
                <button onClick={onPrevYear} aria-label="Previous year" className="px-2 py-1 text-sm sm:px-3 sm:py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">&laquo; Yr</button>
                <button onClick={onPrevMonth} aria-label="Previous month" className="px-2 py-1 text-sm sm:px-3 sm:py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">&lsaquo; Mo</button>
            </div>
            <div className="text-center">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {monthName} {year}
                </h2>
                <button onClick={onGoToToday} className="text-xs sm:text-sm text-blue-500 dark:text-blue-400 hover:underline">Go to Today</button>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
                <button onClick={onNextMonth} aria-label="Next month" className="px-2 py-1 text-sm sm:px-3 sm:py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Mo &rsaquo;</button>
                <button onClick={onNextYear} aria-label="Next year" className="px-2 py-1 text-sm sm:px-3 sm:py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Yr &raquo;</button>
            </div>
        </div>
    );
};

const CalendarGrid = ({ days, completedDays, onDayClick }) => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
        <div className="grid grid-cols-7 gap-px bg-gray-300 dark:bg-gray-700 border border-gray-300 dark:border-gray-700">
            {weekdays.map(day => (
                <div key={day} className="text-center font-semibold p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    {day}
                </div>
            ))}
            {days.map(({ date, isCurrentMonth, key }, index) => {
                const isCompleted = !!completedDays[key];
                const today = isCurrentMonth && isToday(date);
                const cellClasses = [
                    "relative p-1 aspect-square transition-colors duration-200 ease-in-out cursor-pointer group flex items-center justify-center overflow-hidden",
                    isCurrentMonth ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" : "bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600",
                    isCompleted ? "!bg-green-500 dark:!bg-green-600 !text-white dark:!text-gray-100" : "",
                    isCurrentMonth ? "hover:bg-blue-100 dark:hover:bg-blue-900/50" : "hover:bg-gray-200 dark:hover:bg-gray-700/50",
                    today ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900 z-10" : ""
                ].filter(Boolean).join(' ');

                return (
                    <div
                        key={key || index}
                        className={cellClasses}
                        onClick={() => isCurrentMonth && onDayClick(date)}
                        role="button"
                        aria-pressed={isCompleted}
                        aria-label={`Date ${date.getDate()}, ${isCompleted ? 'Completed' : 'Not Completed'}`}
                    >
                        <span className={`text-xs md:text-sm font-medium z-10 ${isCompleted ? 'opacity-70' : ''}`}>
                            {date.getDate()}
                        </span>
                         {isCompleted && (
                             <div className="absolute inset-0 flex items-center justify-center text-white dark:text-gray-100 transition-transform transform scale-0 animate-pop-in">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const CalendarControls = ({ onMarkAll, onReset, onExport, onImport }) => {
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => onImport(e.target.result);
            reader.readAsText(file);
            event.target.value = null;
        }
    };
    return (
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
            <button onClick={onMarkAll} aria-label="Mark all visible days as completed" className="px-3 py-1.5 text-sm md:px-4 md:py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Mark All
            </button>
            <button onClick={onReset} aria-label="Reset completions for the current month" className="px-3 py-1.5 text-sm md:px-4 md:py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition-colors flex items-center gap-1">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Reset Month
            </button>
            <button onClick={onExport} aria-label="Export completion data" className="px-3 py-1.5 text-sm md:px-4 md:py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors flex items-center gap-1">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
            </button>
            <input type="file" id="import-file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
            <button onClick={() => document.getElementById('import-file').click()} aria-label="Import completion data" className="px-3 py-1.5 text-sm md:px-4 md:py-2 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 transition-colors flex items-center gap-1">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Import
            </button>
        </div>
    );
};

// **[FIXED]** Ensure this component has its correct implementation
const ThemeToggleButton = ({ isDarkMode, setIsDarkMode }) => (
    <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
        {isDarkMode ? '☀️' : '🌙'}
    </button>
);

// **[FIXED]** Ensure this component has its correct implementation
const StatsDisplay = ({ stats }) => (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md transition-colors duration-300">
        <h3 className="text-lg font-semibold mb-3 text-center text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">Statistics</h3>
        <div className="flex flex-col sm:flex-row justify-around items-center gap-4 text-center pt-2">
            <div>
                <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{stats.currentStreak} 🔥</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Current Streak</div>
            </div>
            <div>
                <div className="text-3xl font-bold text-red-500 dark:text-red-400">{stats.longestStreak} 🏆</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Longest Streak</div>
            </div>
             <div>
                <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">{stats.monthlyPercentage}%</div>
                 <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Month Completion ({stats.completedInMonth}/{stats.totalDaysInMonth})
                </div>
            </div>
        </div>
    </div>
);

// **[FIXED]** Ensure this component has its correct implementation
const MonthlyNote = ({ note, onNoteChange }) => (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md transition-colors duration-300">
         <label htmlFor="monthly-note" className="block text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2 text-center border-b border-gray-200 dark:border-gray-700 pb-2">
             Monthly Notes / Goals
         </label>
        <textarea
            id="monthly-note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add your notes or goals for this month..."
            rows={3}
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 transition resize-none mt-2"
        />
    </div>
);


/**
 * Main App Component
 */
function App() {
    const {
        currentDate, completedDays, setCompletedDays, calendarDays,
        changeMonth, changeYear, goToToday, stats,
        currentNote, updateNote, monthlyNotes, setMonthlyNotes
     } = useCalendar();
    const [isDarkMode, setIsDarkMode] = useLocalStorage(LOCAL_STORAGE_KEYS.IS_DARK_MODE, window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const handleDayClick = useCallback((date) => {
        const key = getDateKey(date);
        if (!key) return;
        setCompletedDays(prev => {
            const newCompleted = { ...prev };
            if (newCompleted[key]) {
                delete newCompleted[key];
            } else {
                newCompleted[key] = true;
            }
            return newCompleted;
        });
    }, [setCompletedDays]);

    const handleMarkAll = useCallback(() => {
        setCompletedDays(prev => {
            const newCompleted = { ...prev };
            let changed = false;
            calendarDays.forEach(({ date, isCurrentMonth }) => {
                if (isCurrentMonth) {
                    const key = getDateKey(date);
                    if (key && !newCompleted[key]) {
                        newCompleted[key] = true;
                        changed = true;
                    }
                }
            });
            return changed ? newCompleted : prev;
        });
    }, [calendarDays, setCompletedDays]);

    const handleResetMonth = useCallback(() => {
        const currentMonthKeys = calendarDays
            .filter(d => d.isCurrentMonth)
            .map(d => d.key)
            .filter(Boolean);

        const hasCompletions = currentMonthKeys.some(key => completedDays[key]);
        if (!hasCompletions) {
            alert("No completions to reset for the current month.");
            return;
        }

        if (window.confirm("Are you sure you want to reset completions for this month?")) {
            setCompletedDays(prev => {
                const newCompleted = { ...prev };
                currentMonthKeys.forEach(key => {
                    delete newCompleted[key];
                });
                return newCompleted;
            });
        }
    }, [calendarDays, completedDays, setCompletedDays]);

    const handleExport = useCallback(() => {
        const dataToExport = { completedDays, monthlyNotes };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json;charset=utf-8' });
        saveAs(blob, `completion-calendar-data-${getDateKey(new Date())}.json`);
    }, [completedDays, monthlyNotes]);

    const handleImport = useCallback((jsonData) => {
        try {
            const data = JSON.parse(jsonData);
            if (!data || typeof data.completedDays !== 'object' || typeof data.monthlyNotes !== 'object') {
                 throw new Error('Invalid data format.');
            }
             if (window.confirm("Importing will overwrite current data. Are you sure?")) {
                setCompletedDays(data.completedDays);
                setMonthlyNotes(data.monthlyNotes);
                alert('Data imported successfully!');
             }
        } catch (error) {
            alert(`Failed to import data. Please ensure the file is valid. Error: ${error.message}`);
        }
    }, [setCompletedDays, setMonthlyNotes]); // Correctly use the setters


    return (
        <div className="bg-gray-100 dark:bg-gray-950 min-h-screen p-4 sm:p-6 lg:p-8 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">🗓️ Completion Calendar Pro</h1>
                    <ThemeToggleButton isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
                </div>
                <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-hidden mb-6 transition-colors duration-300">
                    <CalendarHeader
                        currentDate={currentDate}
                        onPrevYear={() => changeYear(-1)}
                        onNextYear={() => changeYear(1)}
                        onPrevMonth={() => changeMonth(-1)}
                        onNextMonth={() => changeMonth(1)}
                        onGoToToday={goToToday}
                    />
                    <CalendarGrid
                        days={calendarDays}
                        completedDays={completedDays}
                        onDayClick={handleDayClick}
                    />
                    <CalendarControls
                        onMarkAll={handleMarkAll}
                        onReset={handleResetMonth}
                        onExport={handleExport}
                        onImport={handleImport}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <StatsDisplay stats={stats} />
                     <MonthlyNote note={currentNote} onNoteChange={updateNote} />
                 </div>
                 <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
                    <p>Track your goals. Build consistency. Data saved locally.</p>
                </footer>
            </div>
        </div>
    );
}

export default App;

// Keep animation style tag
const style = document.createElement('style');
style.textContent = `
    @keyframes pop-in {
        0% { transform: scale(0.5); opacity: 0; }
        70% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
    }
    .animate-pop-in {
        animation: pop-in 0.3s ease-out forwards;
    }
`;
document.head.append(style);
