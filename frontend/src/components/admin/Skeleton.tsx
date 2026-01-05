import React, { memo } from 'react';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    variant?: 'text' | 'rect' | 'circle';
    className?: string;
}

/**
 * Skeleton loading component for better perceived performance.
 * Shows animated placeholder while content is loading.
 */
const Skeleton: React.FC<SkeletonProps> = memo(({
    width = '100%',
    height = '1rem',
    variant = 'rect',
    className = ''
}) => {
    const baseStyle: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'linear-gradient(90deg, #e0e0e0 25%, #f5f5f5 50%, #e0e0e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? '4px' : '8px',
    };

    return (
        <>
            <div style={baseStyle} className={`skeleton ${className}`} />
            <style>{`
                @keyframes skeleton-pulse {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </>
    );
});

Skeleton.displayName = 'Skeleton';

/**
 * Table skeleton for admin tables
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = memo(({ rows = 5, cols = 5 }) => (
    <div className="skeleton-table">
        <style>{`
            .skeleton-table {
                background: white;
                border-radius: 8px;
                padding: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .skeleton-row {
                display: flex;
                gap: 1rem;
                margin-bottom: 0.75rem;
                padding: 0.5rem 0;
            }
            .skeleton-header {
                border-bottom: 1px solid #e0e0e0;
                padding-bottom: 0.75rem;
                margin-bottom: 0.5rem;
            }
        `}</style>
        <div className="skeleton-row skeleton-header">
            {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} height={16} width={`${100 / cols - 2}%`} />
            ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
            <div className="skeleton-row" key={rowIdx}>
                {Array.from({ length: cols }).map((_, colIdx) => (
                    <Skeleton key={colIdx} height={14} width={`${100 / cols - 2}%`} />
                ))}
            </div>
        ))}
    </div>
));

TableSkeleton.displayName = 'TableSkeleton';

/**
 * Stats card skeleton for overview
 */
export const StatsSkeleton: React.FC = memo(() => (
    <div className="skeleton-stats">
        <style>{`
            .skeleton-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            .skeleton-stat-card {
                background: white;
                border-radius: 8px;
                padding: 1.25rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
        `}</style>
        {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-stat-card" key={i}>
                <Skeleton height={14} width="60%" />
                <div style={{ height: '0.5rem' }} />
                <Skeleton height={28} width="40%" />
            </div>
        ))}
    </div>
));

StatsSkeleton.displayName = 'StatsSkeleton';

export default Skeleton;
