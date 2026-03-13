import React from 'react';
import { Metric } from '../../types';
import ProgressBar from './ProgressBar';

const TrendIndicator: React.FC<{ direction?: 'up' | 'down' | 'neutral', text?: string }> = ({ direction, text }) => {
    if (!direction || !text) return null;

    const color = direction === 'up' ? 'text-green-500' : direction === 'down' ? 'text-red-500' : 'text-slate-500';
    const icon = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';

    return (
        <span className={`text-xs font-semibold ${color} flex items-center`}>
            {icon && <span className="mr-1">{icon}</span>}
            {text}
        </span>
    );
};

const MetricCard: React.FC<Metric> = ({ label, value, trend, trendDirection, tooltip, unit, progress }) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300" title={tooltip}>
                    {label}
                </p>
                <TrendIndicator direction={trendDirection} text={trend} />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {value}{unit}
            </p>
            {progress !== undefined && <ProgressBar progress={progress} className="mt-2" />}
        </div>
    );
};

export default MetricCard;
