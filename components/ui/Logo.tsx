import React, { useId } from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => {
    const id = useId();
    const gradient1 = `logoGradient1-${id}`;
    const gradient2 = `logoGradient2-${id}`;

    return (
        <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                {/* Lighter gradient for the right side, for better visibility */}
                <linearGradient id={gradient1} x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>
                {/* Slightly darker gradient for the left side for 3D effect */}
                 <linearGradient id={gradient2} x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
            </defs>
            {/* Left side of the arrow/plane, darker for depth */}
            <path d="M 50 15 L 15 85 L 60 85 L 50 15 Z" fill={`url(#${gradient2})`} />
            {/* Right side of the arrow/plane, lighter */}
            <path d="M 50 15 L 85 85 L 60 85 L 50 15 Z" fill={`url(#${gradient1})`} />
        </svg>
    );
};

export default Logo;