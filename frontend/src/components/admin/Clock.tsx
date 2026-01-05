import React, { useState, useEffect, memo } from 'react';

interface ClockProps {
    className?: string;
}

/**
 * Isolated Clock component that updates every second.
 * Using React.memo to prevent parent component re-renders from affecting it,
 * and isolating the setInterval here so only this component re-renders every second.
 */
const Clock: React.FC<ClockProps> = memo(({ className }) => {
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={className || 'header-datetime'}>
            <div className="datetime-date">
                {currentDateTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}
            </div>
            <div className="datetime-time">
                {currentDateTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                })}
            </div>
        </div>
    );
});

Clock.displayName = 'Clock';

export default Clock;
