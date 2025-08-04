import React, { useState, useEffect, useCallback } from 'react';

// --- Custom Hooks ---

/**
 * A custom hook to manage state in localStorage.
 * @param {string} key - The key for the localStorage item.
 * @param {any} initialValue - The initial value if nothing is in localStorage.
 * @returns {[any, (value: any) => void]} - The state and a function to update it.
 */
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}

/**
 * A custom hook to manage the calendar logic.
 * @returns {object} - An object containing calendar state and functions.
 */
function useCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [completedDays, setCompletedDays] = useLocalStorage('completedDays', {});

    const generateCalendarDays = useCallback((date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        const days = [];

        const prevMonthLastDay = new Date(year, month, 0);
        const prevMonthDays = prevMonthLastDay.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }

        const gridEndOffset = 42 - days.length;
        for (let i = 1; i <= gridEndOffset; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
        }

        return days;
    }, []);

    const calendarDays = generateCalendarDays(currentDate);

    const changeMonth = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const changeYear = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear() + offset, prev.getMonth(), 1));
    };

    return { currentDate, completedDays, setCompletedDays, calendarDays, changeMonth, changeYear };
}


// --- Helper Functions ---

const zeroPad = (n) => n.toString().padStart(2, '0');

const getDateKey = (date) => {
    if (!date) return '';
    return `${date.getFullYear()}-${zeroPad(date.getMonth() + 1)}-${zeroPad(date.getDate())}`;
};


// --- React Components ---

const CalendarHeader = ({ currentDate, onPrevYear, onNextYear, onPrevMonth, onNextMonth }) => {
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    return (
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
            <div className="flex items-center space-x-2">
                <button onClick={onPrevYear} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">&laquo; Year</button>
                <button onClick={onPrevMonth} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">&lsaquo; Month</button>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
                {monthName} {year}
            </h2>
            <div className="flex items-center space-x-2">
                <button onClick={onNextMonth} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Month &rsaquo;</button>
                <button onClick={onNextYear} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Year &raquo;</button>
            </div>
        </div>
    );
};

const CalendarGrid = ({ days, completedDays, onDayClick }) => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
            {weekdays.map(day => (
                <div key={day} className="text-center font-semibold p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm">
                    {day}
                </div>
            ))}
            {days.map(({ date, isCurrentMonth }, index) => {
                const key = getDateKey(date);
                const isCompleted = !!completedDays[key];
                
                const cellClasses = [
                    "relative p-2 h-20 md:h-28 transition-all duration-200 ease-in-out cursor-pointer group",
                    isCurrentMonth ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600",
                    isCompleted ? "bg-green-200 dark:bg-green-800/50" : "",
                    isCurrentMonth ? "hover:bg-blue-100 dark:hover:bg-blue-900/50" : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
                ].join(' ');

                return (
                    <div key={index} className={cellClasses} onClick={() => onDayClick(date)}>
                        <span className={`absolute top-2 right-2 text-sm font-medium ${isCurrentMonth ? 'text-gray-700 dark:text-gray-200' : ''}`}>
                            {date.getDate()}
                        </span>
                         {isCompleted && (
                            <div className="absolute bottom-2 left-2 text-green-600 dark:text-green-400 transition-opacity opacity-0 group-hover:opacity-100">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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

const CalendarControls = ({ onMarkAll, onReset }) => {
    return (
        <div className="flex items-center justify-center space-x-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-b-lg">
            <button onClick={onMarkAll} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors">
                Mark All Visible
            </button>
            <button onClick={onReset} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition-colors">
                Reset Current Month
            </button>
        </div>
    );
};

const ThemeToggleButton = ({ isDarkMode, setIsDarkMode }) => (
    <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
        {isDarkMode ? '☀️' : '🌙'}
    </button>
);


/**
 * Main App Component
 */
function App() {
    const { currentDate, completedDays, setCompletedDays, calendarDays, changeMonth, changeYear } = useCalendar();
    const [isDarkMode, setIsDarkMode] = useLocalStorage('isDarkMode', false);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    const handleDayClick = (date) => {
        const key = getDateKey(date);
        setCompletedDays(prev => {
            const newCompleted = { ...prev };
            if (newCompleted[key]) {
                delete newCompleted[key];
            } else {
                newCompleted[key] = true;
            }
            return newCompleted;
        });
    };
    
    const handleMarkAll = () => {
        const newCompleted = { ...completedDays };
        calendarDays.forEach(({ date, isCurrentMonth }) => {
            if (isCurrentMonth) {
                newCompleted[getDateKey(date)] = true;
            }
        });
        setCompletedDays(newCompleted);
    };

    const handleResetMonth = () => {
        const newCompleted = { ...completedDays };
        calendarDays.forEach(({ date, isCurrentMonth }) => {
            if (isCurrentMonth) {
                delete newCompleted[getDateKey(date)];
            }
        });
        setCompletedDays(newCompleted);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen p-4 sm:p-6 lg:p-8 font-sans text-gray-900 dark:text-gray-100">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Completion Calendar</h1>
                    <ThemeToggleButton isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
                </div>
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg overflow-hidden">
                    <CalendarHeader
                        currentDate={currentDate}
                        onPrevYear={() => changeYear(-1)}
                        onNextYear={() => changeYear(1)}
                        onPrevMonth={() => changeMonth(-1)}
                        onNextMonth={() => changeMonth(1)}
                    />
                    <CalendarGrid
                        days={calendarDays}
                        completedDays={completedDays}
                        onDayClick={handleDayClick}
                    />
                    <CalendarControls 
                        onMarkAll={handleMarkAll}
                        onReset={handleResetMonth}
                    />
                </div>
                 <footer className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
                    <p>Click any day to toggle completion. Data is saved locally in your browser.</p>
                </footer>
            </div>
        </div>
    );
}

export default App;